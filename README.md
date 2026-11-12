# كروت المذاكرة (Flashcards) 📚

موقع ثابت (HTML/CSS/JS) بيحوّل أي ملف (`txt` · `md` · `docx` · `pdf`) لفلاش كاردز **بنفس نص الملف بالظبط بدون تغيير أو إضافات**، ويذاكرها بالاسترجاع النشط (Active Recall) والتكرار المتباعد (Spaced Repetition).

## المميزات
- تقسيم تلقائي لأنواع الأسئلة: كل عنوان مرقّم (`1. Management – العلاج`) بيبقى قسم، وكل قائمة تحت عنوان فرعي (`الأشكال:` / `أمثلة:`) بيبقى كارت لوحده + كارت شامل للقسم.
- شارة الأولوية (عالية جدًا / عالية / متوسطة / أقل) بتتربط بالأقسام تلقائيًا من جدول الأولويات في الملف.
- الجملة الرئيسية في كل كارت بتظهر بتظليل ملوّن، والمصطلح الرئيسي في كل نقطة بلون مميز، والقوائم مرتبة بأرقام.
- مذاكرة بالاسترجاع: وجه الكارت فيه السؤال بس → (اختياري) اكتب إجابتك من ذاكرتك → اقلب → قيّم نفسك (نسيت / صعب / تمام / سهل) والكارت بيرجعلك في الوقت المناسب.
- خيار إخفاء عناصر القوائم وكشفها واحد واحد.
- فلترة بأنواع الأسئلة (ذاكر Management و Investigations بس مثلًا).
- مظهر داكن مريح وآخر فاتح دافئ، ويشتغل على الموبايل.
- اختصارات: `Space` قلب · `1` نسيت · `2` صعب · `3` تمام · `4` سهل.

## الرفع على GitHub Pages
1. اعمل Repository جديد على GitHub (مثلًا `flashcards`).
2. ارفع **كل ملفات المجلد** (`index.html`, `style.css`, `app.js`, `parser.js`, `sample.js`, `firebase-config.js`, `README.md`).
3. من `Settings → Pages` اختار `Deploy from a branch` ← `main` ← `/ (root)` ← Save.
4. بعد دقيقة الموقع يشتغل على `https://USERNAME.github.io/flashcards/`.

## الحفظ السحابي بحساب جوجل (للدخول من أي جهاز)
من غير الخطوات دي الموقع بيحفظ على الجهاز الحالي بس (وفيه زر نسخة احتياطية / استرجاع).

1. ادخل على [Firebase Console](https://console.firebase.google.com) ← **Add project** (مجاني).
2. **Build → Authentication → Get started → Sign-in method → Google → Enable**.
3. في **Authentication → Settings → Authorized domains** ضيف: `USERNAME.github.io`.
4. **Build → Firestore Database → Create database** (اختار Production mode).
5. في تبويب **Rules** الصق ده واضغط Publish:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```
6. **Project settings → General → Your apps → Web app (`</>`)** ← سجّل التطبيق وانسخ قيم `apiKey, authDomain, projectId, appId`.
7. الصقهم في `firebase-config.js` وارفع الملف على GitHub.

بعد كده اضغط «دخول بجوجل» وهتلاقي ملفاتك وتقدمك على أي جهاز بنفس الحساب. (الـ `apiKey` في Firebase مش سر؛ الحماية من قواعد Firestore فوق.)

## ملاحظات على الملفات
- `txt` / `md` / `docx`: أفضل نتيجة. اكتب العناوين مرقّمة (`1. العنوان`) أو استخدم Heading في Word، والقوائم بشرطة `-` أو Bullets.
- الجداول (في Word أو نص مفصول بـ Tab) بتظهر كجدول.
- `pdf`: بيتقرأ النص بس، وPDF العربي ساعات ترتيب كلماته بيتلخبط؛ الأفضل تحوّله لـ docx أو txt. الـ PDF الممسوح كصور مش مدعوم.
- الملف النموذجي (`sample.js`) هو ملف أنواع أسئلة MEQ بتاعك وبيتضاف تلقائيًا أول مرة.
