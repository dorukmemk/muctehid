# Troubleshooting Guide

## Komutlar 30+ Dakika Boyunca Takılıyor

### Sorun
LLM bir komut çalıştırıyor, çıktı geliyor ama komut sonlanmıyor ve 30 dakika boyunca "devam ediyor" durumunda kalıyor.

### Neden
Watch mode veya server mode komutları (`npm run dev`, `tsc --watch`, `npm start`) sürekli çalışır ve asla sonlanmaz. `executePwsh` bu tür komutları çalıştırırsa, sonlanmayı sonsuza kadar bekler.

### Çözüm

#### 1. Watch/Server Komutları için `controlPwshProcess` Kullan

```typescript
// ❌ YANLIŞ - 30dk takılır
executePwsh({ command: "npm run dev" })

// ✅ DOĞRU - arka planda çalışır
controlPwshProcess({ 
  action: "start", 
  command: "npm run dev" 
})
```

#### 2. Kısa Komutlar için Timeout Ekle

```typescript
// Build komutları
executePwsh({ 
  command: "npm run build",
  timeout: 60000  // 60 saniye
})

// Install komutları
executePwsh({ 
  command: "npm install",
  timeout: 120000  // 120 saniye
})
```

#### 3. Test Komutları için Watch Mode'u Kapat

```json
// package.json
{
  "scripts": {
    "test": "jest --watch",        // ❌ Watch mode
    "test:run": "jest --run"       // ✅ Tek seferlik
  }
}
```

### Yasaklı Komutlar (executePwsh ile)

Bu komutları `executePwsh` ile ASLA çalıştırma:

- `npm run dev`
- `npm start`
- `tsc --watch`
- `jest --watch`
- `nodemon`
- Herhangi bir `--watch` parametreli komut

### Kontrol Listesi

Bir komut çalıştırmadan önce:

- [ ] Komut watch/server mode'da mı?
  - Evet → `controlPwshProcess` kullan
  - Hayır → devam et
  
- [ ] Komut 60 saniyeden uzun sürebilir mi?
  - Evet → `timeout` ekle veya `controlPwshProcess` kullan
  - Hayır → `executePwsh` kullan

- [ ] Komut `--watch` parametresi içeriyor mu?
  - Evet → `controlPwshProcess` kullan veya parametreyi kaldır
  - Hayır → `executePwsh` kullan

### Arka Plan Process'leri Yönetme

```typescript
// Process başlat
const { terminalId } = await controlPwshProcess({
  action: "start",
  command: "npm run dev"
})

// Çıktıyı oku
await getProcessOutput({ terminalId })

// Process'leri listele
await listProcesses()

// Process'i durdur
await controlPwshProcess({
  action: "stop",
  terminalId
})
```

### Sorun Devam Ediyorsa

1. Çalışan process'leri kontrol et:
   ```typescript
   listProcesses()
   ```

2. Takılı process'i durdur:
   ```typescript
   controlPwshProcess({ action: "stop", terminalId: "..." })
   ```

3. Komutu timeout ile tekrar dene:
   ```typescript
   executePwsh({ 
     command: "...",
     timeout: 60000 
   })
   ```

## Diğer Yaygın Sorunlar

### MCP Tool'ları Çalışmıyor

1. MCP server çalışıyor mu?
   ```bash
   npm start
   ```

2. Index güncel mi?
   ```typescript
   index_codebase()
   ```

3. Graph build edilmiş mi?
   ```typescript
   graph_build()
   ```

### Bellek Sistemi Yavaş

1. Eski event'leri temizle:
   ```typescript
   memory_consolidate({ olderThanDays: 7 })
   ```

2. Bellek istatistiklerini kontrol et:
   ```typescript
   memory_system_stats()
   ```

3. Gerekirse decay çalıştır:
   ```typescript
   memory_decay({ olderThanDays: 90 })
   ```
