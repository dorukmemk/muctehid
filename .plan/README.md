# GitNexus Integration — Implementation Plan

## 📋 Özet

GitNexus'un knowledge graph yeteneklerini müctehid-mcp'ye entegre ediyoruz. LLM'ler artık kod tabanını **graf olarak** görebilecek ve yapısal ilişkileri anlayabilecek.

## 🎯 Hedef Yetenekler

1. **Impact Analysis** — "Bu fonksiyonu değiştirirsem ne kırılır?"
2. **360° Context** — Bir sembol için tüm ilişkileri göster
3. **Process Detection** — Execution flow'ları takip et
4. **Cluster Detection** — Functional modülleri tespit et
5. **Safe Rename** — Multi-file rename with confidence scoring
6. **Pre-Commit Impact** — Git diff + impact analysis

## 📁 Dosyalar

- `gitnexus-integration-spec.md` — Detaylı teknik spec
- `task_plan.md` — Task breakdown (36 gün, 6 faz)
- `../GITNEXUS_INTEGRATION.md` — Kullanıcı dokümantasyonu
- `../AGENTS.md` — Agent instructions (güncellenmiş)

## 🚀 Hızlı Başlangıç

### 1. Spec'i İncele
```bash
cat .plan/gitnexus-integration-spec.md
```

### 2. Task'lara Bak
```bash
cat .plan/task_plan.md
```

### 3. İlk Task'ı Başlat
```
Task 1.1: LadybugDB Entegrasyonu (2 gün)
- package.json'a dependency ekle
- GraphStore class oluştur
- Schema tanımla
```

## 📊 İlerleme

- ✅ Spec yazıldı
- ✅ Task breakdown yapıldı
- ✅ AGENTS.md güncellendi
- ⏳ Implementasyon başlamadı

## 🔗 Referanslar

- GitNexus: https://github.com/abhigyanpatwari/GitNexus
- LadybugDB: https://github.com/kuzudb/kuzu
- Tree-sitter: https://tree-sitter.github.io/tree-sitter/

## 💡 Sonraki Adımlar

1. **Şimdi:** Task 1.1 (LadybugDB Entegrasyonu)
2. **Sonra:** Task 1.2 (Tree-sitter Parser)
3. **MVP:** Faz 1-2 tamamla (13 gün)
