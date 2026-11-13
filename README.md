# Muhasebe

Müşteri alacaklarını, kart harcamalarını, tahsilatları ve abonelikleri takip etmek için Türkçe ve İngilizce bir web uygulaması. Her kurulum kendi Supabase projesine bağlanır. Yeni hesaplar boş açılır.

## Android uygulaması

Android 7.0 ve üzeri için imzalı [APK 0.4.6 dosyasını](https://github.com/HamzaSarikaya/muhasebe-defteri/releases/download/v0.4.6/Muhasebe-0.4.6.apk) indirin ve açın. Mevcut uygulamayı kaldırmadan güncelleyebilirsiniz. Bu sürüm, Chrome açılışına geçmek yerine uygulamanın kendi WebView penceresini kullanır. Logo ilk içerik çizilene kadar kalır. Güncel Android System WebView ve internet bağlantısı gerekir. 0.4.3 veya önceki sürümden geçerken tarayıcı oturumu aktarılmadığından bir kez yeniden giriş yapılır; mali kayıtlar sunucuda korunur.

APK'nın kaynağı ve yeniden derleme adımları [android/README.md](android/README.md) içindedir. İmza anahtarları depoya dahil değildir. Kaynaklardan kendi anahtarınızla derlediğiniz paketin site doğrulaması için `public/.well-known/assetlinks.json` dosyasını kendi sertifikanızla güncelleyin.

## Kurulum

Node.js 22 veya üzeri, npm ve bir Supabase projesi gerekir.

1. Kaynak kodu indirip proje klasöründe `npm ci` çalıştırın.
2. Supabase SQL Editor’da `supabase/migrations` klasöründeki SQL dosyalarını numara sırasıyla birer kez çalıştırın.
3. Supabase Authentication ayarlarından açık kaydı kapatın ve kullanacağınız hesabı oluşturun.
4. `.env.example` dosyasını `.env.local` adıyla kopyalayın. `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` alanlarını kendi projenizin adresi ve yayımlanabilir anahtarıyla doldurun. Bu alanlara yönetici anahtarı girmeyin.
5. `npm run dev` çalıştırın. [Yerel uygulamayı açın](http://localhost:3000/tr) ve Genel bakış, Kartlar, Müşteriler veya İşlemler ekranından giriş yapın.

Üretim sürümünü çalıştırmak için `npm run build` ve ardından `npm start` kullanın. Mobil kurulum için HTTPS gerekir. Finansal kayıtlar çevrimiçi işlenir.

## İlk işleminizi kaydedin

- **Kartlar** ekranına kartınızı, limitini, ekstre kesim gününü ve son ödeme gününü girin.
- **Müşteriler** ekranında bir müşteri ve ona bağlı bir alt hesap oluşturun. Müşteri borçları alt hesap bazında takip edilir.
- **İşlemler** ekranında harcamayı girin. Peşin ödeme için taksit sayısını 1 bırakın. Başka bir para birimi kullanıyorsanız işlem anındaki kuru girin.
- Ödeme aldığınızda ilgili borcu veya taksiti seçip tahsilatı kaydedin. Müşteri ve bağlı kartın bakiyesi birlikte güncellenir.

Tutarlar kuruş veya cent olarak tutulur. Taksit bölünürken kalan kuruşlar ilk takside eklenir. Bir borca bağlı tahsilat varsa, borcu iptal etmeden önce tahsilat düzeltilmelidir.

## Genel bakış ve müşteri detayları

- **Genel bakış** ekranında toplam alacağı, bu ayki tahsilatı ve bekleyen taksitleri para birimine göre inceleyin. Bir müşterinin avansı başka bir müşterinin açık alacağını azaltmaz.
- Son altı ayın kapanış alacağı ve aylık tahsilatı çizgi grafiğinde gösterilir. İçinde bulunulan ay bugüne kadardır. Harcama dağılımı bu ayın kişisel ve müşteri harcamalarını karşılaştırır; iadeler düşülür. Taksitli alışverişin anaparası işlem ayında yer alır.
- Kart borcu ve limit kullanımı her kartın kendi para birimindedir. Kişisel ve müşteri payları ayrı görünür. Geçmiş işlem kuru eksikse bakiye yerine açıklama gösterilir; limit aşımı ayrıca belirtilir.
- Müşteri adına tıklayarak alt hesapların borç, tahsilat, iade ve kalan bakiyelerini; ödeme ilerlemesini ve hareket geçmişini açın. Dil değişimi bulunduğunuz müşteri sayfasını korur.
- Yaklaşan ve geciken vadeler genel bakışın altında yer alır. Hesaplamalar Europe/Istanbul tarihini kullanır; gelecek tarihli kayıtlar genel bakışa o gün geldiğinde katılır.

Para birimleri birbirine eklenmez. Grafik etiketleri ve tutarlar kuruş hassasiyetini korur; grafikteki verilerin tablo veya liste karşılığı da bulunur. Geçmiş trend mevcut kayıtlardan hesaplanır; silinmiş tahsilatların veya iptal edilmiş işlemlerin değişiklik günlüğü değildir.

Bağlantı ya da oturum yokken tutarlar `—`, bağlantılı boş hesaplarda sıfır görünür. Yeni kurulumda otomatik müşteri, kart veya işlem oluşturulmaz. Başlangıç kayıtları yalnızca kullanıcının seçimiyle eklenir.

## Abonelikler ve dönem raporları

- Abonelikler ekranında hizmet adı, sağlayıcı, ücret, para birimi, aylık/yıllık dönem, kart ve sonraki yenileme tarihi kaydedilir. Duraklatılan abonelikler toplamlardan çıkarılır; görünürlük seçeneğiyle yeniden düzenlenebilir, etkinleştirilebilir veya silinebilir.
- Yıllık yük, aylık ücretlerin 12 katı ile yıllık ücretlerin toplamıdır. Aylık karşılık bu toplamın 12'ye bölünüp en yakın kuruşa yuvarlanmasıdır. Önce toplam alınır, yalnızca gösterimde yuvarlanır. TRY, USD ve EUR birbirine eklenmez. Bu değerler mevcut ücretlerin karşılığıdır; belirli bir ayda tahsil edilecek tutarın tahmini değildir.
- Tarihi gelen abonelikte Düzenle → Sonraki döneme ilerlet, tarihi bir dönem taşır. 31 Ocak → 28 Şubat → 31 Mart ve yıllık 29 Şubat döngüsü korunur. Tarihi elle değiştirmek yenileme gününü yeniden belirler. Yinelenen ilerletme isteği tarihi ikinci kez taşımaz. Geçmiş dönemler tek tek ilerletilir. Abonelik takibi kendiliğinden finansal işlem veya ödeme oluşturmaz.
- Raporlar ekranında kategori toplamları, iadeler, müşteri tahsilatları ve açık taksitlerin aylık takvimi bulunur. İlk görünüm bu ayın başından bugüne kadardır; Temizle tüm tarihleri açar. Kategori dökümü işlem tarihini, tahsilat ödeme tarihini, takvim vade tarihini kullanır. Taksitli alışverişin tüm satırları aynı alışveriş tarihini taşır; kategori analizi bu tarihte toplam alışverişi gösterir. İptaller analize dahil edilmez. Takvim, bugüne kadar kaydedilmiş tahsilatlar sonrası kalan tutarı gösterir; ileri tarihli tahsilatlar bugünkü kalanı azaltmaz.
- İşlemler ve Raporlar ekranlarında açıklama, müşteri, alt hesap, kart veya kategori aranabilir. Tarih uçları dahildir. Geçersiz tarih aralığı açık hata gösterir ve CSV indirmeyi durdurur. Mobilde Raporlar üst çubuktaki grafik simgesinden veya Abonelikler ekranından açılır.
- **Filtreli CSV** seçili işlem ve tahsilatları içerir; tutarlar gruplama işareti olmadan iki ondalık basamakla yazılır. Taksit grubu, bağlantılı işlem kimliği, kart kuru ve kuruş bazında kur ofseti ayrı sütunlardadır. UTF-8 BOM Türkçe karakterleri korur; formül başlatan metinler elektronik tablo çalıştırmasını engelleyecek biçimde kaçırılır.
- **Tam yedek (JSON)** filtrelerden bağımsız tüm profil, kart, müşteri, alt hesap, işlem, tahsilat ve abonelik kayıtlarını içerir. Kimlikler, tarihler, notlar ve işlem anındaki kurlar korunur; büyük parasal sayılar ve kurlar metindir. Dosya sürümlüdür (`muhasebe-ledger`, sürüm 1); Auth parolası/oturumu veya ortak kur önbelleği içermez. İçe aktarma arayüzü bu fazın kapsamında değildir.

Faz 4 yükseltmesi: üçüncü migration'ı uygulayın, `npm ci`, `npm run build` çalıştırın ve sunucuyu yeniden başlatın. Bağlantı anahtarları `.env.local` içinde korunur.

## Önceki sürümlerden yükseltme

`0.4.4` kaynaklarını indirin ve mevcut `.env.local` dosyanızı koruyun. `0.1.0` veya `0.2.0` kuruluysa önce `supabase/migrations/202611050003_phase4.sql`, ardından `202611050004_access_defaults.sql` dosyasını birer kez uygulayın. `0.3.0` kuruluysa yalnızca dördüncü migration gerekir. Ardından `npm ci`, `npm run build` ve `npm start` ile yeniden başlatın. `0.4.0`, `0.4.1` veya `0.4.2` üzerinden bu sürüme geçişte yeni migration gerekmez. Önceden uygulanmış migration dosyalarını yeniden çalıştırmayın. Yeni kurulumda dört SQL dosyasının tamamını numara sırasıyla uygulayın.

## Mobil kullanım ve PWA

Telefon ve yatay ekran yerleşimi, beş hedefli alt menü ve ekran kenarı boşlukları desteklenir. Android tarayıcısının yükleme seçeneği veya iOS Safari → Paylaş → Ana Ekrana Ekle ile kurabilirsiniz. HTTPS gerekir. Kurulu uygulama da finansal işlemleri çevrimiçi yapar.

Çevrimdışıyken yeni sayfa açılışı Türkçe/İngilizce bilgi ekranına gider. Yeniden dene aynı adresi tekrar açar. Açık ekranda bağlantı uyarısı görünür; form gönderilmez ve yazılan alanlar yalnızca açık sekmenin belleğinde kalır. Bağlantı geri geldiğinde otomatik yenileme veya otomatik kayıt olmaz. Sekmeyi kapatmak veya elle yenilemek kaydedilmemiş alanları siler.

Service worker yalnızca statik dosyaları ve çevrimdışı bilgi sayfasını önbelleğe alır. Finansal HTML, RSC, API ve oturum yanıtları saklanmaz. Geliştirme modunda service worker kapalıdır; çevrimdışı testi üretim derlemesinde yapılır.

## Vercel ile yayın

[DEPLOY.md](DEPLOY.md), Supabase kurulumu, Vercel ortam değişkenleri, ücretsiz plan sınırları, üretim kontrolleri ve geri dönüş adımlarını açıklar. Vercel `vercel.json` içindeki `npm run build:deploy` komutunu kullanır; eksik bağlantı ayarları, yerel sunucu, test modu veya açık kullanıcı kaydı varsa derleme durur. Normal `npm run build`, bağlantısız yerel inceleme için çalışır.

Dördüncü migration, gelecekteki tablo ve fonksiyonların varsayılan erişimini kapatır. Yeni nesneler ancak kendi migration’larında açıkça izin verilirse API üzerinden kullanılabilir. Mevcut kayıtlar ve açıkça verilmiş uygulama izinleri korunur.

## Testler

```sh
npm run check
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:dashboard
```

Standart tarayıcı testlerini bağlantı ayarları boşken çalıştırın. Oturum açmayı, taksitli harcamayı ve tahsilatı tarayıcıda denemek için ayrı bir yerel Supabase test projesi kullanın. Test projesinin bağlantı değişkenlerini ve `LEDGER_TEST_EMAIL`, `LEDGER_TEST_PASSWORD` değerlerini terminal ortamında tanımlayıp yeniden derleyin ve `npm run test:e2e` çalıştırın. Bu senaryo test hesabına kayıt yazar.

`npm run test:dashboard`, ayrı bir derlemede yalnızca yerel bir servis taklidi kullanır. Oturum gereksinimi, döviz seçimi, dolu ve boş hesaplar, hata durumları, müşteri detayları, çok büyük tutarlar, limit aşımı, mobil yerleşim ve erişilebilirlik sınanır. 3101 ve 54329 portları boş olmalıdır. Çevrimdışı kaydın engellenmesi, form alanlarının korunması, yeniden deneme, dokunma alanları, yatay telefon ve simüle edilmiş safe-area boşlukları da sınanır. Bunlar fiziksel cihaz testi değildir. Abonelik ekleme, düzenleme, yenileme, duraklatma ve silme; işlem filtreleri ve gerçek CSV/JSON indirmeleri de sınanır. Test yazımları yalnızca bellekte tutulur. Test kayıtları gerçek veritabanına yazılmaz ve normal uygulamada gösterilmez.

Birim testleri ve yerel servis taklidi gerçek Supabase kimlik doğrulaması, oturum yenilemesi veya canlı bulut bağlantısını doğrulamaz. Canlı servislerle çalışan mali kayıt senaryosu ayrıca kendi test projenizde çalıştırılmalıdır. Üretim service worker'ı yalnızca statik uygulama dosyalarını ve çevrimdışı bilgi sayfasını önbelleğe alır; finansal sayfalar ve oturum yanıtları önbelleğe alınmaz.

GitHub Actions, ana dal güncellemeleri ve pull request’lerde lint, TypeScript, birim/veritabanı testleri, üretim derlemesi, PWA ve dolu hesap tarayıcı senaryolarını çalıştıracak şekilde tanımlıdır.

## Performans kontrolü

İşlem/tahsilat geçmişi, taksit takvimi ve abonelik listeleri 50 satırlık sayfalarla gösterilir. Filtreler bütün kayıtları arar; CSV tüm eşleşmeleri, JSON tam yedeği içerir. Kapalı işlem ve abonelik formları ilk açıldığında hazırlanır; kapatıp açmak taslağı silmez. Abonelik sayfası tarayıcıya ilgisiz işlem geçmişini taşımaz. Parasal hesaplar BigInt ile, kur dönüşümleri yarım kuruşu sıfırdan uzağa yuvarlayarak yapılır.

Tekrarlanabilir, sahte verili hesaplama ölçümü: `npx tsx scripts/benchmark-finance.ts 10000`. Ağ ve tarayıcı çizim süreleri bu ölçüme dahil değildir. Mali veriler ortak bir önbelleğe alınmaz.
