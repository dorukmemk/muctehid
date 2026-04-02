# Komut Timeout Sorunu - Çözüm Özeti

## Sorun
LLM komutları çalıştırıyor, çıktı geliyor ama komut sonlanmıyor ve 30 dakika boyunca "devam ediyor" durumunda kalıyor.

## Kök Neden
Watch mode veya server mode komutları (`npm run dev`, `tsc --watch`, `npm start`) sürekli çalışır ve asla sonlanmaz. `executePwsh` bu tür komutları çalıştırırsa, sonlanmayı sonsuza kadar bekler.

## Yapılan Değişiklikler

### 1. package.json
- `test:run` script'i eklendi (watch mode olmayan test komutu)

### 2. .cursorrules
- Komut kuralları bölümü eklendi
- Watch/server komutları için `controlPwshProcess` kullanımı zorunlu kılındı
- Timeout kuralları eklendi

### 3. .kiro/steering/muctehid.md
- Komut kuralları bölümü eklendi
- Yasaklı komutlar listesi eklendi
- Timeout örnekleri eklendi

### 4. AGENTS.md
- "KOMUT ÇALIŞTIRMA KURALLARI" bölümü eklendi (dosya sonuna)
- Detaylı tablo ve örnekler
- Sorun giderme adımları

### 5. TROUBLESHOOTING.md (YENİ)
- Komut timeout sorunu için detaylı rehber
- Çözüm örnekleri
- Kontrol listesi
- Diğer yaygın sorunlar

### 6. README.md
- "Sorun Giderme" bölümü eklendi
- TROUBLESHOOTING.md'ye referans

## Çözüm Özeti

### Watch/Server Komutları için
```typescript
// ❌ YANLIŞ
executePwsh({ command: "npm run dev" })

// ✅ DOĞRU
controlPwshProcess({ 
  action: "start", 
  command: "npm run dev" 
})
```

### Kısa Komutlar için
```typescript
// Timeout ekle
executePwsh({ 
  command: "npm run build",
  timeout: 60000  // 60 saniye
})
```

### Test Komutları için
```bash
# Watch mode yerine
npm run test:run
```

## Yasaklı Komutlar (executePwsh ile)

- `npm run dev`
- `npm start`
- `tsc --watch`
- `jest --watch`
- `nodemon`
- Herhangi bir `--watch` parametreli komut

## Sonuç

Artık LLM:
1. Watch/server komutlarını `controlPwshProcess` ile çalıştıracak
2. Kısa komutlara timeout ekleyecek
3. Test komutları için watch mode kullanmayacak
4. Sorun yaşarsa TROUBLESHOOTING.md'ye bakabilecek

Bu değişiklikler `.cursorrules`, `AGENTS.md` ve `muctehid.md` steering dosyalarında zorunlu kural olarak tanımlandı.
