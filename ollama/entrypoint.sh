#!/bin/sh

# Ollama modelini kontrol et, eksikse indir
if ! ollama list | grep -q "deepseek-r1"; then
  echo "Model deepseek-r1 bulunamadı, indiriliyor..."
  ollama pull deepseek-r1
else
  echo "Model deepseek-r1 zaten yüklü."
fi

# Ollama sunucusunu başlat
exec ollama serve
