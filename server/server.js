import express from 'express';
import multer from 'multer';
import fs from 'fs';
import cors from 'cors';
import pdfjs from 'pdfjs-dist/legacy/build/pdf.js';
import LlamaAI from 'llamaai';
import axios from 'axios';

// LlamaAI API ve konfigürasyon
const config = {
    port: process.env.PORT || 4000,
    uploadDir: 'uploads/',
    llamaApiUrl: process.env.LLAMA_API_URL || 'http://localhost:11434/api/generate',
    model: 'deepseek-r1', // ÖNCEKİ: 'llama3.3'
    temperature: parseFloat(process.env.TEMPERATURE) || 0.7,
    maxTokens: parseInt(process.env.MAX_TOKENS, 10) || 4000
};


const apiToken = 'LA-69ba4be496e543dda6caae14a443970e81310a489317488cbb4cd4f2284845bb';
const llamaAPI = new LlamaAI(apiToken);

const app = express();

// PDF analiz sonucunu saklayacak değişken
let storedPDFContent = null;
let currentDocumentType = null;

app.use(cors());
app.use(express.json());

//api isteği gönderir
const sendApiRequest = async (messages) => {
    try {
        const response = await axios.post(config.llamaApiUrl, {
            model: config.model,
            messages: messages,
            temperature: config.temperature,
            max_tokens: config.maxTokens
        });

        return response.data;
    } catch (error) {
        console.error('API request error:', error);
        throw new Error('API isteği başarısız oldu');
    }
};

// Multer yapılandırması
const upload = multer({ dest: config.uploadDir });

// PDF'den metin çıkarma
const extractTextFromPDF = async (filePath) => {
    const pdfBuffer = fs.readFileSync(filePath);
    const pdfDoc = await pdfjs.getDocument({ data: pdfBuffer }).promise;

    let extractedText = '';
    for (let i = 0; i < pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i + 1);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item) => item.str).join(' ');
        extractedText += pageText + '\n';
    }

    return extractedText;
};

// Temizleme endpoint'i
app.post('/clear', (req, res) => {
    storedPDFContent = null;
    res.json({ message: 'Temizlendi' });
});

// PDF yükleme ve analiz endpoint'i
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const pdfPath = req.file.path;
        const documentType = req.body.documentType;
        
        // Store document type
        currentDocumentType = documentType;

        // PDF'den metin çıkarma
        const pdfText = await extractTextFromPDF(pdfPath);
        
        // PDF içeriğini sakla
        storedPDFContent = pdfText;

        if (documentType === 'signature') {
            // İmza sirküleri analizi - İlk prompt
            const firstPromptJson = {
                messages: [
                    { role: "system", content: "Extract only signatories in 'Name - Position' format, one per line." },
                    { role: "user", content: `List signatories from this document: ${pdfText}` },
                ],
                stream: false,
            };

            // İmza sirküleri analizi - İkinci prompt (Yapılandırılmış JSON çıktısı için)
            const secondPromptJson = {
                messages: [
                    { 
                        role: "system", 
                        content: `You are analyzing a signature circular (İmza Sirküleri). Create a valid JSON array containing signature authorities.
Keep responses concise and ensure the JSON is complete. Format:

[{
    "yetkili_kişi": "Full name of the authorized person",
    "işlem_tipi": "List all transaction types they are authorized for",
    "yetkisi_olduğu_hesap": "Account numbers they have authority over, or 'Bilgi Bulunamadı'",
    "tutar_limit": number or "Bilgi Bulunamadı",
    "para_birimi": "TL", "USD", "EUR" or "Bilgi Bulunamadı",
    "temsil_şekli": "Münferit" or "Müşterek"
}]

For Müşterek (joint) signatures:
- "gerekli_ortak_sayısı": "Number of required joint signatures"
- "temsil_ortakları": ["Name1", "Name2"]

Rules:
1. Keep responses brief
2. Return ONLY valid JSON array
3. No explanations or text outside JSON
4. Ensure JSON is complete for all people`
                    },
                    { 
                        role: "user", 
                        content: `Return ONLY a JSON array for: ${pdfText}` 
                    }
                ],
                stream: false,
                max_tokens: config.maxTokens,
                temperature: config.temperature
            };

            const [firstResponse, secondResponse] = await Promise.all([
                sendApiRequest(firstPromptJson),
                sendApiRequest(secondPromptJson)
            ]);

            // Parse the second response to ensure it's valid JSON
            let parsedSecondResponse;
            try {
                // Helper function to clean and validate JSON string
                const cleanJSONString = (str) => {
                    try {
                        // First try direct parsing
                        JSON.parse(str);
                        return str;
                    } catch (e) {
                        // If direct parsing fails, clean the string
                        let cleaned = str;
                        
                        // Remove any text before the first [
                        const firstBracket = cleaned.indexOf('[');
                        if (firstBracket !== -1) {
                            cleaned = cleaned.substring(firstBracket);
                        }
                        
                        // Remove any text after the last ]
                        const lastBracket = cleaned.lastIndexOf(']');
                        if (lastBracket !== -1) {
                            cleaned = cleaned.substring(0, lastBracket + 1);
                        }

                        // Remove markdown code block markers
                        cleaned = cleaned.replace(/```json\s*/g, '');
                        cleaned = cleaned.replace(/```\s*/g, '');
                        
                        // Fix common JSON formatting issues
                        cleaned = cleaned.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":'); // Ensure property names are quoted
                        cleaned = cleaned.replace(/:\s*'([^']*)'/g, ':"$1"'); // Convert single quotes to double quotes
                        cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas
                        
                        // Try parsing the cleaned string
                        try {
                            JSON.parse(cleaned);
                            return cleaned;
                        } catch (e) {
                            console.error('Failed to clean JSON:', e);
                            // Return a valid default JSON if cleaning fails
                            return '[{"yetkili_kişi":"Bilgi Bulunamadı","işlem_tipi":"Bilgi Bulunamadı","yetkisi_olduğu_hesap":"Bilgi Bulunamadı","tutar_limit":"Bilgi Bulunamadı","para_birimi":"Bilgi Bulunamadı","temsil_şekli":"Bilgi Bulunamadı"}]';
                        }
                    }
                };

                console.log('Raw response:', secondResponse.choices[0].message.content);
                let cleanedResponse = cleanJSONString(secondResponse.choices[0].message.content);
                console.log('Cleaned response:', cleanedResponse);

                parsedSecondResponse = JSON.parse(cleanedResponse);
                
                // Validate the structure
                if (!Array.isArray(parsedSecondResponse)) {
                    throw new Error('Response is not an array');
                }

                // Validate each object in the array
                parsedSecondResponse = parsedSecondResponse.map(item => {
                    // Ensure all required fields exist
                    const requiredFields = ["yetkili_kişi", "işlem_tipi", "yetkisi_olduğu_hesap", "tutar_limit", "para_birimi", "temsil_şekli"];
                    requiredFields.forEach(field => {
                        if (!(field in item)) {
                            item[field] = "Bilgi Bulunamadı";
                        }
                    });

                    // Convert tutar_limit to number if possible
                    if (item.tutar_limit && item.tutar_limit !== "Bilgi Bulunamadı") {
                        // Keep the original string format for Turkish number notation
                        if (typeof item.tutar_limit === 'string' && item.tutar_limit.includes('.')) {
                            item.tutar_limit = item.tutar_limit;
                        } else {
                            // If it's a number, format it in Turkish notation
                            const num = parseFloat(item.tutar_limit.toString().replace(/[.,]/g, ''));
                            if (!isNaN(num)) {
                                item.tutar_limit = num.toLocaleString('tr-TR', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                }).replace(/\s/g, '.') + ' TL';
                            }
                        }
                    }

                    return item;
                });

            } catch (error) {
                console.error('Error parsing JSON response:', error);
                parsedSecondResponse = [
                    {
                        "yetkili_kişi": "Bilgi Bulunamadı",
                        "işlem_tipi": "Bilgi Bulunamadı",
                        "yetkisi_olduğu_hesap": "Bilgi Bulunamadı",
                        "tutar_limit": "Bilgi Bulunamadı",
                        "para_birimi": "Bilgi Bulunamadı",
                        "temsil_şekli": "Bilgi Bulunamadı"
                    }
                ];
            }

            res.json({ 
                analysis: firstResponse, 
                secondAnalysis: parsedSecondResponse,
                type: 'signature' 
            });
        } else {
            // Normal dosya analizi
            const apiRequestJson = {
                messages: [
                    { 
                        role: "system", 
                        content: "Analyze this PDF document as if you were a lawyer.Identify the type of document and summarize its main topic.Highlight the key legal points and clauses to focus on.Outline any potential risks or issues for the bank.Provide recommendations or legal actions that may be necessary.Respond in Turkish in a professional and concise manner."

                    },
                    { 
                        role: "user", 
                        content: `Analyze this legal document and provide a detailed summary: ${pdfText}` 
                    },
                ],
                stream: false,
            };

            const response = await sendApiRequest(apiRequestJson);
            console.log( "response", response);
            res.json({ analysis: response, type: 'normal' });
        }

        // Geçici dosyayı sil
        fs.unlinkSync(pdfPath);
        console.log(' Geçici PDF dosyası silindi, ama içerik hala hafızada');

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ error: 'Failed to process the PDF' });
    }
});

// Chat endpoint'i
app.post('/chat', async (req, res) => {
    const { message } = req.body;
    console.log(' Yeni sohbet mesajı:', message);
    console.log(' PDF içeriği durumu:', storedPDFContent ? 'Mevcut' : 'Boş');
    console.log(' Döküman tipi:', currentDocumentType);

    if (!storedPDFContent) {
        console.log(' PDF içeriği bulunamadı - chat işlemi yapılamıyor');
        return res.status(400).json({
            error: "Önce bir PDF yüklemelisiniz."
        });
    }

    try {
        console.log(' LlamaAI sohbet yanıtı isteniyor...');
        
        let systemPrompt = '';
        if (currentDocumentType === 'signature') {
            systemPrompt = `You are an assistant specialized in analyzing signature circulars. 
            You have access to a signature circular document with the following content: ${storedPDFContent}
            Please provide accurate information about the signatories, their authorities, and any specific details about their signing powers.
            Focus on answering questions about who can sign, their positions, and their authorization limits.`;
        } else {
            systemPrompt = `You are a legal document analysis assistant with expertise in Turkish law.
            You have access to a legal document with the following content: ${storedPDFContent}
            Provide detailed analysis and explanations about the document's content, legal implications, and specific clauses.
            Focus on explaining legal terms, requirements, and implications in clear, understandable terms.`;
        }
        
        const apiRequestJson = {
            messages: [
                { 
                    role: "system", 
                    content: systemPrompt
                },
                { 
                    role: "user", 
                    content: message 
                }
            ],
            stream: false,
        };

        const response = await sendApiRequest(apiRequestJson);
        console.log(' LlamaAI yanıtı:', response.choices[0].message.content);
        
        res.json({ reply: response.choices[0].message.content });
        console.log(' Sohbet yanıtı başarıyla gönderildi');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            error: "Soru işlenirken bir hata oluştu."
        });
    }
});

// Server'ı başlat
app.listen(config.port, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${config.port}`);
});
