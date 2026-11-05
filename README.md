# Muhasebe

Müşteri alacaklarını, kart harcamalarını ve tahsilatları takip etmek için Türkçe ve İngilizce bir web uygulaması. Her kurulum kendi Supabase projesine bağlanır. Yeni hesaplar boş açılır.

## Kurulum

Node.js 22 veya üzeri, npm ve bir Supabase projesi gerekir.

1. Kaynak kodu indirip proje klasöründe `npm ci` çalıştırın.
2. Supabase SQL Editor’da `supabase/migrations` klasöründeki SQL dosyalarını numara sırasıyla birer kez çalıştırın.
3. Supabase Authentication ayarlarından açık kaydı kapatın ve kullanacağınız hesabı oluşturun.
4. `.env.example` dosyasını `.env.local` adıyla kopyalayın. `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` alanlarını kendi projenizin adresi ve yayımlanabilir anahtarıyla doldurun. Bu alanlara yönetici anahtarı girmeyin.
5. `npm run dev` çalıştırın. [Yerel uygulamayı açın](http://localhost:3000/tr) ve Kartlar, Müşteriler veya İşlemler ekranından giriş yapın.

Üretim sürümünü çalıştırmak için `npm run build` ve ardından `npm start` kullanın. Mobil kurulum için HTTPS gerekir. Finansal kayıtlar çevrimiçi işlenir.

## İlk işleminizi kaydedin

- **Kartlar** ekranına kartınızı, limitini, ekstre kesim gününü ve son ödeme gününü girin.
- **Müşteriler** ekranında bir müşteri ve ona bağlı bir alt hesap oluşturun. Müşteri borçları alt hesap bazında takip edilir.
- **İşlemler** ekranında harcamayı girin. Peşin ödeme için taksit sayısını 1 bırakın. Başka bir para birimi kullanıyorsanız işlem anındaki kuru girin.
- Ödeme aldığınızda ilgili borcu veya taksiti seçip tahsilatı kaydedin. Müşteri ve bağlı kartın bakiyesi birlikte güncellenir.

Tutarlar kuruş veya cent olarak tutulur. Taksit bölünürken kalan kuruşlar ilk takside eklenir. Bir borca bağlı tahsilat varsa, borcu iptal etmeden önce tahsilat düzeltilmelidir.

## Testler

```sh
npm run check
npm run build
npx playwright install chromium
npm run test:e2e
```

Standart tarayıcı testlerini bağlantı ayarları boşken çalıştırın. Oturum açmayı, taksitli harcamayı ve tahsilatı tarayıcıda denemek için ayrı bir yerel Supabase test projesi kullanın. Test projesinin bağlantı değişkenlerini ve `LEDGER_TEST_EMAIL`, `LEDGER_TEST_PASSWORD` değerlerini terminal ortamında tanımlayıp yeniden derleyin ve `npm run test:e2e` çalıştırın. Bu senaryo test hesabına kayıt yazar.
