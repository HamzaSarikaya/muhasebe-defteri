# Vercel ve Supabase ile yayın

Uygulama Next.js sunucusu ve Supabase gerektirir. Statik dışa aktarma kullanılmaz. Kaynak kodu yayını ile çalışan web uygulaması ayrı adımlardır.

## 1. Veritabanı

1. Kendi Supabase projenizi açın. Authentication → Sign In / Providers bölümünde **Allow new users to sign up** ve anonim girişi kapatın; Users bölümünde tek yönetici hesabınızı oluşturun. Yeni proje açık kayda izin verebilir; bu ayarı varsaymayın.
2. Yeni kurulumda `supabase/migrations` altındaki dört SQL dosyasını sıra numarasıyla birer kez uygulayın. CLI kullanıyorsanız projenizi bağlayıp `supabase db push` çalıştırın. SQL Editor kullanıyorsanız uygulanmış dosyaları tekrar çalıştırmayın.
3. `0.1.0` veya `0.2.0` sürümünden yükseltirken `202611050003_phase4.sql` ve ardından `202611050004_access_defaults.sql` gerekir. `0.3.0` kuruluysa yalnızca dördüncü migration uygulanır. Mevcut kayıtlarınızı yükseltmeden önce dışa aktarın.
4. Projenin Connect bölümünden proje adresi ile publishable key alın. Eski projelerde anon key desteklenir. `service_role` ve secret key tarayıcıya verilmez.

Resmî kaynak: [Supabase / Next.js kurulumu](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs).

## 2. Vercel projesi

1. Kaynak deposunu Vercel hesabınıza aktarın veya proje klasöründe `vercel login` ve `vercel link` çalıştırın. Mevcut proje varsa aynı projeyi seçin.
2. Framework olarak Next.js, Node.js 22 veya üzerini seçin. `vercel.json`, `npm ci` ve `npm run build:deploy` komutlarını tanımlar.
3. Vercel Environment Variables bölümünde aşağıdaki değerleri üretim ortamına ekleyin. Önizlemelerde ayrı bir Supabase test projesi kullanın.

| Değişken | Değer |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Kendi HTTPS Supabase proje adresiniz |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Aynı projenin publishable key değeri |

Eski anon anahtarı gerekiyorsa ikinci alan yerine `NEXT_PUBLIC_SUPABASE_ANON_KEY` kullanılabilir. Testlere ait `LEDGER_DASHBOARD_TEST`, `LEDGER_TEST_EMAIL` ve `LEDGER_TEST_PASSWORD` üretime eklenmez. Anahtarları Git'e veya `vercel.json` içine yazmayın.

4. Üretimi Vercel arayüzünden dağıtın veya bağlı proje klasöründe `vercel --prod` çalıştırın. Üretim adresini Supabase Authentication → URL Configuration → Site URL alanına girin. Parolalı girişte callback yolu kullanılmaz; ileride e-posta bağlantılı giriş eklenirse ilgili yönlendirmeler ayrıca tanımlanır.
5. Ortam değişkenlerini değiştirdikten sonra yeniden derleyip dağıtın. Next.js `NEXT_PUBLIC_` değişkenlerini derleme sırasında istemci koduna yerleştirir.

Yerel `.env.local` dosyası Vercel'e kendiliğinden aktarılmaz. Derleme ön kontrolü Supabase Auth ayarlarını okuyarak açık kaydın ve anonim girişin kapalı olduğunu da denetler; doğrulanamazsa dağıtımı durdurur. Bu kontrol migration'ların uygulanmasını veya RLS kurallarını kanıtlamaz.

## Ücret ve kota sınırları

Bu kurulum Supabase **Free** ve Vercel **Hobby** planlarında kalmalıdır. Pro/Team, ücretli compute, gelişim branch'i, özel alan adı satın alma ve ücretli eklenti açmayın. Harcama sınırı olan ücretli bir plan, ücretsiz planın yerine geçmez; sabit abonelik ücretini sıfırlamaz.

Supabase, Free planda kota aşımını ücretlendirmediğini belirtir; kaynaklara göre uyarı, tolerans süresi ve kısıtlama uygulanabilir. Vercel Hobby'de ek kullanım faturası yerine limit/kısıtlama uygulanır. Bunlar kotanın dolduğu milisaniyede bütün hizmetlerin kapanacağı garantisi değildir. Hesabı sonradan ücretli plana geçirmek bu davranışı değiştirir. Planları kendi panellerinizde Free/Hobby olarak koruyun.

Kaynaklar: [Supabase maliyet kontrolü](https://supabase.com/docs/guides/platform/cost-control), [Vercel Hobby](https://vercel.com/docs/plans/hobby).

Resmî kaynaklar: [Vercel CLI ile dağıtım](https://vercel.com/docs/projects/deploy-from-cli), [ortam değişkenleri](https://vercel.com/docs/environment-variables).

## 3. Yayın doğrulaması

Uygulamayı paylaşırken Vercel projesinin sabit üretim alan adını kullanın. Standard Protection açıkken uzun dağıtım bağlantıları Vercel hesabı isteyebilir; bu ekran uygulamanın kendi Supabase girişiyle aynı değildir. Önizleme korumasını kaldırmadan sabit üretim adresinden erişilebilir.

Adres çubuğunda ve tarayıcının yeni parola kayıtlarında Vercel yerine kendi alan adınızın görünmesi için projeye sahip olduğunuz bir alan adı veya alt alan adı bağlayın. Yeni bir alan adı satın almak zorunlu değildir. DNS değerlerini ilgili proje/domain ayarlarından alın; başka sitenin ve e-posta hizmetinin mevcut kayıtlarını koruyun. Üretim Site URL ve gerekiyorsa Auth yönlendirmeleri de yeni adresle güncellenmelidir. Android uygulaması güvenilen hostu sabitlediği için alan adı değişikliği Android kaynakları ve imzalı APK güncellemesi de gerektirir. Google ile giriş eklemek, sitenin yayın adresini değiştirmez.

Kaynaklar: [Standard Protection](https://vercel.com/docs/deployment-protection#standard-protection), [özel alan adı bağlama](https://vercel.com/docs/domains/set-up-custom-domain).

- `/tr` ve `/en` adreslerini açın. Yönetici girişi, çıkış ve sayfa yenilemesinde oturumun korunmasını doğrulayın.
- Boş hesabın örnek finansal veri göstermediğini kontrol edin. Ayrı test hesabında kart, müşteri, alt hesap, taksit ve tahsilat akışını deneyin; tutarların aynı kaldığını doğrulayın.
- Abonelik ekleme/düzenleme, filtreler ve CSV/JSON indirmesini doğrulayın. Gerçek hesapla test verisi oluşturmayın.
- HTTPS üzerinden Android Chrome veya iOS Safari ile açın. Android'de tarayıcının yükleme seçeneğini, iOS'ta Paylaş → Ana Ekrana Ekle seçeneğini kullanın. Safe-area, yatay ekran, ekran klavyesi, son form alanı ve alt menüyü gerçek cihazda kontrol edin.
- Çevrimdışıyken yeni sayfanın bilgi ekranını açtığını ve Yeniden dene ile aynı adrese dönüldüğünü kontrol edin. Açık formda bağlantıyı kesip kaydetmeyi deneyin; değerler korunmalı, bağlantı dönünce kendiliğinden kayıt oluşmamalıdır.
- DevTools → Application → Cache Storage altında yalnızca uygulama statikleri ve `offline.html` bulunmalıdır. Finansal HTML, RSC, API veya oturum yanıtları bulunmamalıdır.

## 4. Güncelleme ve geri dönüş

Vercel'de önceki başarılı dağıtıma geri dönebilirsiniz. Veritabanı bununla geri alınmaz; uygulanmış migration'ları silmeyin veya yeniden çalıştırmayın. Dördüncü migration yeni tablo, sequence ve fonksiyonların varsayılan API izinlerini kapatır; mevcut kayıtları değiştirmez. Sonraki migration’lar erişim izinlerini açıkça vermelidir. PWA güncellemesi statik önbelleği yeniler; finansal kayıtlar Supabase'den okunur. Kaydedilmemiş formları korumak için ağ geri geldiğinde otomatik yenileme kapalıdır.

Canlı Vercel dağıtımı, bulut migration'ı ve gerçek Auth kontrolü tamamlanmadan bu maddeler doğrulanmış sayılmaz. Yerel test sonucu, bağlı hesapların üretim doğrulaması yerine geçmez.
