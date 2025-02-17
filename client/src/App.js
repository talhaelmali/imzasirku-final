import React, { useState } from "react";
import axios from "axios";

function App() {
    const [file, setFile] = useState(null);
    const [response, setResponse] = useState("");
    const [loading, setLoading] = useState(false);
    const [question, setQuestion] = useState("");
    const [chatHistory, setChatHistory] = useState([]);
    const [dragActive, setDragActive] = useState(false);
    const [documentType, setDocumentType] = useState('signature');

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleClear = async () => {
        try {
            await axios.post("http://nodejs-server:4000/clear");
            setFile(null);
            setResponse("");
            setChatHistory([]);
            // Input alanını da temizle
            const fileInput = document.querySelector('input[type="file"]');
            if (fileInput) fileInput.value = "";
        } catch (error) {
            console.error("Temizleme hatası:", error);
        }
    };

    const handleDownloadJSON = () => {
        if (response?.secondAnalysis) {
            const jsonString = JSON.stringify(response.secondAnalysis, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'analysis_result.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) {
            alert("Lütfen bir dosya seçin.");
            return;
        }

        setLoading(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("documentType", documentType);

        try {
            const res = await axios.post(
                "http://nodejs-server:4000/upload",
                formData,
                {
                    headers: {
                        "Content-Type": "multipart/form-data",
                    },
                }
            );
            setResponse(res.data);
        } catch (error) {
            console.error("Error uploading file:", error.message);
            setResponse("Error processing the file.");
        } finally {
            setLoading(false);
        }
    };

    const handleQuestionSubmit = async (e) => {
        e.preventDefault();
        if (!question.trim()) return;

        const userQuestion = question.trim();
        setChatHistory([
            ...chatHistory,
            { type: "question", text: userQuestion },
        ]);
        setQuestion("");

        try {
            const res = await axios.post("http://nodejs-server:4000/chat", {
                message: userQuestion,
            });
            setChatHistory((prev) => [
                ...prev,
                { type: "answer", text: res.data.reply },
            ]);
        } catch (error) {
            if (error.response?.data?.error) {
                setChatHistory((prev) => [
                    ...prev,
                    { type: "error", text: error.response.data.error },
                ]);
            } else {
                setChatHistory((prev) => [
                    ...prev,
                    { type: "error", text: "Bir hata oluştu. Lütfen tekrar deneyin." },
                ]);
            }
        }
    };
    //İmza Tablosu
    const signatoryTable = (content) => {
        if (!content) return null;

        const parseContent = (text) => {
            return text
                .split("\n")
                .filter((line) => line.trim() && line.includes("-"))
                .map((line) => {
                    const [name, fullPosition] = line
                        .split(/-(.+)/)
                        .map((part) => part?.trim())
                        .filter(Boolean);
                    return {
                        name: name.replace(/^\d+\.\s*/, ""),
                        position: fullPosition,
                    };
                });
        };

        const signatories = parseContent(content);

        const tableStyle = {
            width: "100%",
            borderCollapse: "collapse",
            backgroundColor: "#F6F6F6",
            border: "1px solid #e0e0e0",
        };

        const headerStyle = {
            backgroundColor: "#fff",
            color: "#333",
            padding: "15px",
            textAlign: "left",
            borderBottom: "1px solid #e0e0e0",
            fontSize: "14px",
            fontWeight: "500"
        };

        const cellStyle = {
            padding: "15px",
            borderBottom: "1px solid #e0e0e0",
            color: "#666",
            fontSize: "14px"
        };

        const numberCellStyle = {
            ...cellStyle,
            width: "40px",
            textAlign: "center",
            color: "#333",
            fontWeight: "500",
            backgroundColor: "#fff"
        };

        return (
            <div style={{ overflowX: "hidden", height: "100%" }}>
                <table style={tableStyle}>
                    <thead>
                        <tr>
                            <th style={{ ...headerStyle, width: "40px" }}>#</th>
                            <th style={headerStyle}>Ad-Soyad</th>
                            <th style={headerStyle}>Pozisyon/Yetki</th>
                        </tr>
                    </thead>
                    <tbody>
                        {signatories.map((person, index) => (
                            <tr key={index}>
                                <td style={numberCellStyle}>{index + 1}</td>
                                <td style={cellStyle}>{person.name}</td>
                                <td style={cellStyle}>{person.position}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    // Dosya sürükleme işleyicileri
    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave" || e.type === "drop") {
            setDragActive(false);
        }
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const droppedFile = e.dataTransfer.files[0];
            if (droppedFile.type === "application/pdf") {
                setFile(droppedFile);
                // Input alanını da güncelle
                const fileInput = document.querySelector('input[type="file"]');
                if (fileInput) {
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(droppedFile);
                    fileInput.files = dataTransfer.files;
                }
            } else {
                alert("Lütfen sadece PDF dosyası yükleyin.");
            }
        }
    };

    const renderAnalysisResult = () => {
        const emptyTable = (
            <table style={{
                width: "100%",
                borderCollapse: "collapse",
                backgroundColor: "#F6F6F6",
                border: "1px solid #e0e0e0"
            }}>
                <thead>
                    <tr>
                        <th style={{
                            backgroundColor: "#fff",
                            color: "#333",
                            padding: "15px",
                            textAlign: "left",
                            borderBottom: "1px solid #e0e0e0",
                            fontSize: "14px",
                            fontWeight: "500",
                            width: "40px"
                        }}>#</th>
                        <th style={{
                            backgroundColor: "#fff",
                            color: "#333",
                            padding: "15px",
                            textAlign: "left",
                            borderBottom: "1px solid #e0e0e0",
                            fontSize: "14px",
                            fontWeight: "500"
                        }}>Ad-Soyad</th>
                        <th style={{
                            backgroundColor: "#fff",
                            color: "#333",
                            padding: "15px",
                            textAlign: "left",
                            borderBottom: "1px solid #e0e0e0",
                            fontSize: "14px",
                            fontWeight: "500"
                        }}>Pozisyon/Yetki</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td colSpan="3" style={{ padding: "30px", textAlign: "center", color: "#666" }}>
                            Henüz analiz yapılmadı
                        </td>
                    </tr>
                </tbody>
            </table>
        );

        const emptyAnalysis = (
            <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: "15px",
                color: "#666"
            }}>
                <img src="/nomessage.png" alt="No Analysis" style={{ width: "150px", opacity: 0.7 }} />
                <p style={{ 
                    fontSize: "15px",
                    fontStyle: "italic",
                    margin: 0
                }}>
                    Henüz dosya analizi yapılmadı
                </p>
            </div>
        );

        if (!response || !response.analysis) {
            if (documentType === 'signature') {
                return (
                    <div style={{
                        height: "100%",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column"
                    }}>
                        {emptyTable}
                    </div>
                );
            }
            return emptyAnalysis;
        }

        if (response.type === 'signature') {
            return (
                <div style={{
                    height: "100%",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column"
                }}>
                    {signatoryTable(response.analysis.choices[0].message.content)}
                </div>
            );
        } else {
            const analysis = response.analysis.choices[0].message.content;
            return (
                <div style={{
                    backgroundColor: "white",
                    padding: "20px",
                    borderRadius: "8px",
                    whiteSpace: "pre-wrap",
                    height: "100%",
                    overflow: "auto",
                    fontSize: "14px",
                    lineHeight: "1.6",
                    color: "#333"
                }}>
                    {analysis}
                </div>
            );
        }
    };

    // Dosya yükleme alanı için stil değişkeni
    const dropAreaStyle = {
        flex: 1,
        border: dragActive ? `2px dashed #2B5A24` : `2px solid #E0E0E0`,
        borderRadius: "8px",
        padding: "15px",
        textAlign: "center",
        backgroundColor: dragActive ? "#F0F7F0" : "#F9F9F9",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        transition: "all 0.2s ease-in-out"
    };

    return (
        <div style={{
            height: "100vh",
            display: "flex",
            fontFamily: "Arial, sans-serif",
            backgroundColor: "#fff",
            overflow: "hidden",
            gap: "20px",
            padding: "25px 40px"
        }}>
            {/* Left Section */}
            <div style={{
                width: "32%",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                height: "calc(100vh - 50px)"
            }}>
                {/* File Upload Area */}
                <div style={{
                    height: "30%",
                    display: "flex",
                    flexDirection: "column",
                    backgroundColor: "#F9F9F9",
                    borderRadius: "8px",
                    padding: "12px"
                }}>
                    <h3 style={{
                        color: "#19710B",
                        fontSize: "18px",
                        fontWeight: "bold",
                        marginBottom: "12px"
                    }}>Dosya Seçiniz</h3>
                    <div
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => document.getElementById('fileInput').click()}
                        style={dropAreaStyle}
                    >
                        <img src="/arrow.png" alt="Arrow" style={{ width: "80px", height: "50px" }} />
                        <p style={{
                            margin: "0",
                            color: "#666",
                            fontSize: "13px",
                            fontFamily: "Helvetica",
                            fontStyle: "italic",
                        }}>
                            {file ? file.name : "Yalnızca pdf formatlı dosya yükleyiniz"}
                        </p>
                        <input
                            type="file"
                            accept="application/pdf"
                            onChange={handleFileChange}
                            style={{ display: "none" }}
                            id="fileInput"
                        />
                        <button
                            style={{
                                color: "#2B5A24",
                                border: "none",
                                backgroundColor: "white",
                                padding: "10px 20px",
                                borderRadius: "8px",
                                cursor: "pointer",
                                fontSize: "16px",
                                fontWeight: "bold",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px"
                            }}
                        >
                            {file ? "Dosyayı Değiştir" : "Buraya Yükleyiniz"}
                            <img src="/send.png" alt="Upload" style={{ width: "24px", height: "24px" }} />
                        </button>
                    </div>
                </div>

                {/* Document Type Selection */}
                <div style={{
                    height: "10%",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    marginBottom: "4px"
                }}>
                    <h3 style={{
                        color: "#2B5A24",
                        fontSize: "16px",
                        fontWeight: "bold",
                        fontFamily: "Helvetica",
                        margin: 0
                    }}>Döküman Tipi:</h3>
                    <select
                        value={documentType}
                        onChange={(e) => setDocumentType(e.target.value)}
                        style={{
                            width: "100%",
                            height: "45px",
                            padding: "0 15px",
                            borderRadius: "8px",
                            border: "1px solid #ddd",
                            fontSize: "14px",
                            fontFamily: "Helvetica"
                        }}
                    >
                        <option value="signature">İmza Sirküleri</option>
                        <option value="normal">Normal Dosya</option>
                    </select>
                </div>

                {/* Action Buttons */}
                <div style={{
                    display: "flex",
                    gap: "8px",
                    height: "7%",
                    marginBottom: "4px"
                }}>
                    <button
                        onClick={handleSubmit}
                        style={{
                            flex: 1,
                            padding: "12px",
                            backgroundColor: "#2B5A24",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontSize: "14px",
                            fontWeight: "bold",
                        }}
                    >
                        Analiz Et
                    </button>
                    <button
                        onClick={handleClear}
                        style={{
                            flex: 1,
                            padding: "12px",
                            backgroundColor: "#19710B",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontSize: "14px",
                            fontWeight: "bold",
                        }}
                    >
                        Temizle
                    </button>
                </div>

                {/* Q&A Section */}
                <div style={{
                    flex: 1,
                    backgroundColor: "#F9F9F9",
                    borderRadius: "8px",
                    padding: "12px",
                    display: "flex",
                    flexDirection: "column",
                    height: "calc(53% - 16px)"
                }}>
                    <h3 style={{
                        margin: "0 0 15px 0",
                        color: "#2B5A24",
                        fontSize: "16px",
                        fontWeight: "bold",
                        fontFamily: "Helvetica"
                    }}>Soru&Cevap</h3>
                    <div style={{
                        flex: 1,
                        overflowY: "auto",
                        marginBottom: "15px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: chatHistory.length === 0 ? "center" : "flex-start",
                        alignItems: "center"
                    }}>
                        {chatHistory.length === 0 ? (
                            <img src="/nomessage.png" alt="No Messages" style={{ width: "200px" }} />
                        ) : (
                            chatHistory.map((msg, index) => (
                                <div
                                    key={index}
                                    style={{
                                        margin: "5px 0",
                                        padding: "10px 15px",
                                        backgroundColor: msg.type === "question" ? "#4CAF50" : "#f5f5f5",
                                        color: msg.type === "question" ? "white" : "#333",
                                        borderRadius: "5px",
                                        maxWidth: "80%",
                                        alignSelf: msg.type === "question" ? "flex-end" : "flex-start",
                                        width: "fit-content"
                                    }}
                                >
                                    {msg.text}
                                </div>
                            ))
                        )}
                    </div>
                    <form onSubmit={handleQuestionSubmit} style={{
                        display: "flex",
                        gap: "10px"
                    }}>
                        <input
                            type="text"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder="Soru sorun..."
                            style={{
                                flex: 1,
                                padding: "10px",
                                borderRadius: "5px",
                                border: "1px solid #ddd",
                                fontSize: "14px"
                            }}
                        />
                        <button
                            type="submit"
                            style={{
                                padding: "10px 20px",
                                backgroundColor: "#2B5A24",
                                color: "white",
                                border: "none",
                                borderRadius: "5px",
                                cursor: "pointer"
                            }}
                        >
                            Gönder
                        </button>
                    </form>
                </div>
            </div>

            {/* Right Section */}
            <div style={{
                width: "68%",
                backgroundColor: "#fff",
                borderRadius: "8px",
                padding: "20px 25px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                display: "flex",
                flexDirection: "column",
                height: "calc(100vh - 50px)",
                overflow: "hidden"
            }}>
                <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "15px"
                }}>
                    <h2 style={{
                        margin: 0,
                        fontSize: "18px",
                        color: "#2B5A24",
                        fontWeight: "500"
                    }}>{documentType === 'signature' ? 'İmza Yetkilileri' : 'Dosya Analizi'}</h2>
                    {response?.secondAnalysis && (
                        <button
                            onClick={handleDownloadJSON}
                            style={{
                                padding: "8px 16px",
                                backgroundColor: "#2B5A24",
                                color: "white",
                                border: "none",
                                borderRadius: "5px",
                                cursor: "pointer",
                                fontSize: "13px"
                            }}
                        >
                            JSON İNDİR
                        </button>
                    )}
                </div>
                <div style={{
                    flex: 1,
                    overflowY: "auto",
                    backgroundColor: documentType !== 'signature' ? "#F9F9F9" : "transparent",
                    borderRadius: "8px",
                    padding: documentType !== 'signature' ? "15px" : "0"
                }}>
                    {loading ? (
                        <div style={{
                            textAlign: "center",
                            padding: "20px",
                            color: "#666"
                        }}>
                            Dosya Analiz Ediliyor...
                        </div>
                    ) : (
                        renderAnalysisResult()
                    )}
                </div>
            </div>
        </div>
    );
}

export default App;
