import { useMemo, useState } from "react";
import "./privacy-notice.css";

const UPDATED = "6 October 2026";
const PRIVACY_EMAIL = "privacy@myquests.me";

function Section({ title, children }) {
  return (
    <section className="pn-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function DataTable({ rows, rtl = false }) {
  return (
    <div className="pn-table-wrap">
      <table className="pn-table">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PrivacyNotice() {
  const initialLanguage = useMemo(() => {
    const query = new URLSearchParams(window.location.search).get("lang");
    return query === "en" ? "en" : "ar";
  }, []);
  const [lang, setLang] = useState(initialLanguage);
  const isArabic = lang === "ar";

  return (
    <main className="pn-page" dir={isArabic ? "rtl" : "ltr"}>
      <div className="pn-stars" aria-hidden="true" />
      <div className="pn-shell">
        <header className="pn-header">
          <a className="pn-back" href="/" aria-label={isArabic ? "العودة إلى Quest" : "Back to Quest"}>
            {isArabic ? "العودة إلى Quest" : "Back to Quest"}
          </a>

          <div className="pn-language" role="group" aria-label="Language">
            <button type="button" className={isArabic ? "is-active" : ""} onClick={() => setLang("ar")}>
              العربية
            </button>
            <button type="button" className={!isArabic ? "is-active" : ""} onClick={() => setLang("en")}>
              English
            </button>
          </div>

          <div className="pn-mark">QUEST</div>
          <div className="pn-draft">
            {isArabic ? "مسودة ما قبل الإطلاق — ليست النسخة القانونية النهائية بعد" : "PRE-LAUNCH DRAFT — not yet the final legal notice"}
          </div>

          <h1>{isArabic ? "إشعار الخصوصية" : "Privacy Notice"}</h1>
          <p className="pn-updated">
            {isArabic ? `آخر تحديث: ${UPDATED}` : `Last updated: ${UPDATED}`}
          </p>

          <div className="pn-summary">
            <strong>{isArabic ? "رحلتك في Quest تخصك أنت." : "Your Quest belongs to you."}</strong>
            <p>
              {isArabic
                ? "نستخدم بياناتك لتشغيل حسابك، وحفظ مهامك وتقدمك، وتحسين التخطيط الشخصي، وتمكين ميزات الأصدقاء والمنافسات عندما تختار استخدامها. نحن لا نبيع بياناتك الشخصية."
                : "We use your data to run your account, save your tasks and progress, improve personalized planning, and enable friends and competitions when you choose to use them. We do not sell your personal data."}
            </p>
          </div>
        </header>

        {isArabic ? (
          <article className="pn-content">
            <Section title="1. من المسؤول عن بياناتك؟">
              <p>
                Quest منتج مستقل في مرحلة ما قبل الإطلاق ومقره التشغيلي في مصر. قبل الإطلاق العام، ستُستكمل هنا هوية المشغّل القانوني الكاملة وبيانات الاتصال المطلوبة.
              </p>
              <p><strong>المشغّل القانوني:</strong> عبدالرحمن محمد طلعت محمد، بصفته فردًا مقيمًا في مصر.</p>
              <p><strong>البريد المخصص للخصوصية:</strong> <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a></p>
              <p>
                لم يتم تعيين مسؤول حماية بيانات مستقل في مرحلة ما قبل الإطلاق. إذا أصبح تعيينه مطلوبًا أو تم تعيينه لاحقًا، فسنضيف بياناته إلى هذا الإشعار.
              </p>
            </Section>

            <Section title="2. ما البيانات التي يجمعها Quest؟">
              <DataTable rtl rows={[
                ["بيانات الحساب", "البريد الإلكتروني، معرّف الحساب، اسم المستخدم، واسم العرض."],
                ["بيانات الإنتاجية", "أسماء الـ Quests، المهام، الـ Anchors، الأهداف، المواعيد، الأيام والأوقات المخططة."],
                ["بيانات الأداء", "حالة إكمال المهام، XP، المستوى، التقدم، المكافآت وسجل المطالبة بها."],
                ["بيانات الوقت والعمل", "المدة المقدرة، المدة الفعلية، مؤقتات العمل، جلسات التركيز، ووقت الإكمال."],
                ["بيانات التخطيط الشخصي", "أنماط مدة المهام، خطط الأسبوع، تعديلات اليوم، وأنماط عبء العمل."],
                ["البيانات الاجتماعية", "اسم المستخدم العام داخل Quest، الأصدقاء، طلبات الصداقة وحالاتها."],
                ["المنافسات", "المشاركة في المنافسات، XP، عدد المهام، دقائق التركيز، المستوى ونتائج المنافسة."],
                ["بيانات المزرعة", "اسم المزرعة، النباتات، الاكتشافات، مستوى النمو، السجل اليومي والصناديق."],
                ["الإشعارات", "إعدادات الإشعارات، المنطقة الزمنية، اشتراك Push ومعلومات التسليم."],
                ["بيانات تقنية", "معلومات الجلسة والمزامنة، سجلات تشغيلية لازمة للأمان والاعتمادية، وبيانات تخزين محلي لازمة للعمل دون اتصال."],
              ]} />
              <p className="pn-note">
                تحتوي أسماء المهام على نص حر. يرجى عدم إدخال أرقام البطاقات، أرقام الهوية، كلمات المرور، التشخيصات الطبية أو أي معلومات شديدة الحساسية لا تحتاجها Quest.
              </p>
            </Section>

            <Section title="3. من أين نحصل على البيانات؟">
              <p>
                معظم البيانات تأتي منك مباشرة عندما تنشئ حسابًا أو مهمة أو هدفًا أو صداقة أو تشترك في منافسة. بعض المعلومات التقنية تُنشأ تلقائيًا عند استخدام التطبيق، مثل معلومات الجلسة والمزامنة وإشعارات Push.
              </p>
            </Section>

            <Section title="4. لماذا نستخدم بياناتك؟ وما الأساس القانوني؟">
              <DataTable rtl rows={[
                ["تشغيل الحساب والخدمة", "لتسجيل الدخول، حفظ Quest، مزامنة البيانات وتوفير الميزات التي طلبتها. نعتمد أساسًا على الضرورة التعاقدية لتقديم الخدمة."],
                ["التخطيط والتخصيص", "لتحسين تقدير الوقت، حمل اليوم والأسبوع، والإحصائيات الشخصية كجزء من الخدمة التي تطلبها."],
                ["الأصدقاء والمنافسات", "لتنفيذ طلبات الصداقة، المنافسات والترتيب عندما تستخدم هذه الميزات."],
                ["الأمان ومنع إساءة الاستخدام", "لحماية الحسابات، التحقيق في الأعطال أو إساءة الاستخدام، وتحسين موثوقية Quest. نعتمد على مصالح مشروعة لا تتغلب على حقوقك، وقد نعتمد على التزامات قانونية عند الحاجة."],
                ["الإشعارات الاختيارية", "لإرسال إشعارات Push عندما تقوم بتمكينها. يمكنك إيقافها من الإعدادات أو المتصفح/الجهاز."],
                ["طلبات قانونية", "عندما يكون ذلك ضروريًا للامتثال لالتزام قانوني أو أمر صادر عن جهة مختصة."],
              ]} />
            </Section>

            <Section title="5. كيف يعمل التخصيص و«Quest AI» حاليًا؟">
              <p>
                حتى تاريخ هذا الإشعار، يستخدم Quest منطقًا حسابيًا داخل نظامه للتعلم من بياناتك مثل أسماء المهام والفئات، الوقت المتوقع والفعلي، وسجل الإنجاز والتخطيط. الهدف هو تقديم تقديرات أفضل لمدة المهام وحمل اليوم والأسبوع.
              </p>
              <p>
                هذه الميزة الحالية لا ترسل سجل مهامك إلى نموذج ذكاء اصطناعي عام تابع لطرف ثالث من أجل إنشاء هذه التوقعات. إذا تغيّر ذلك في المستقبل، سنحدّث هذا الإشعار قبل تشغيل الميزة ونوضح مزود الخدمة والبيانات التي ستُرسل والغرض منها.
              </p>
            </Section>

            <Section title="6. ما الذي يراه المستخدمون الآخرون؟">
              <p>
                اسم المستخدم واسم العرض يمكن أن يظهرا لمستخدمي Quest الآخرين في البحث، طلبات الصداقة، الأصدقاء والمنافسات. المشاركون في المنافسة قد يرون XP، المستوى، عدد المهام، دقائق التركيز ونتائج المنافسة حسب نوعها.
              </p>
              <p>
                أسماء مهامك ليست عامة افتراضيًا. إذا وفّر نوع منافسة خيار مشاركة أسماء المهام، فلن تتم المشاركة إلا عندما يكون خيار المشاركة مفعّلًا لتلك المنافسة.
              </p>
            </Section>

            <Section title="7. التخزين المحلي وملفات الارتباط">
              <p>
                يستخدم Quest تقنيات تخزين ضرورية على الجهاز للحفاظ على تسجيل الدخول، حفظ نسخة محلية آمنة من حالة Quest عند الحاجة، دعم العمل دون اتصال، ومزامنة التغييرات عند عودة الاتصال.
              </p>
              <p>
                في الوقت الحالي لا نستخدم Meta Pixel أو TikTok Pixel أو ملفات ارتباط إعلانية أو أدوات تتبع تسويقية مماثلة داخل Quest. إذا أضفنا تحليلات أو تتبعًا غير ضروري لاحقًا، فسنراجع متطلبات الموافقة قبل تشغيله.
              </p>
            </Section>

            <Section title="8. من يعالج البيانات نيابةً عنا؟">
              <DataTable rtl rows={[
                ["Supabase", "المصادقة وقاعدة البيانات. مشروع Quest الحالي مستضاف في منطقة eu-west-1 في أيرلندا."],
                ["Vercel", "استضافة التطبيق وتسليمه وتشغيل البنية التحتية. قد تتم المعالجة في الولايات المتحدة ومناطق أخرى يستخدمها Vercel أو مزودوه."],
                ["Resend", "إرسال رسائل تأكيد البريد واستعادة كلمة المرور والرسائل التشغيلية. تخزين بيانات Resend يتم حاليًا في الولايات المتحدة."],
                ["مزود Push الخاص بالمتصفح/الجهاز", "عندما تفعل إشعارات Push، قد يمر الإشعار عبر خدمة Push الخاصة بالمتصفح أو نظام التشغيل الذي تستخدمه."],
              ]} />
              <p>نطلب من مزودي الخدمة معالجة البيانات فقط بالقدر اللازم لتقديم خدماتهم، وفق اتفاقياتهم وإجراءاتهم الأمنية.</p>
            </Section>

            <Section title="9. نقل البيانات خارج مصر">
              <p>
                يعتمد Quest حاليًا على بنية تحتية دولية، ولذلك قد يتم نقل أو تخزين أو معالجة بياناتك الشخصية خارج مصر. قاعدة بيانات Quest الأساسية على Supabase موجودة حاليًا في منطقة أيرلندا (eu-west-1)، بينما تحتفظ Resend ببيانات خدمتها في الولايات المتحدة، وقد تقوم Vercel بالمعالجة في الولايات المتحدة ومواقع أخرى تستخدمها أو يستخدمها مزودوها.
              </p>
              <p>
                قبل إنشاء حساب جديد، يطلب Quest موافقة منفصلة وواضحة على هذا النقل والمعالجة عبر الحدود. يمكنك سحب موافقتك لاحقًا عن طريق التواصل معنا، ولكن لأن البنية التحتية الحالية لـ Quest تعتمد على خدمات خارج مصر، فقد لا نتمكن من الاستمرار في تقديم الحساب بعد سحب هذه الموافقة.
              </p>
              <p className="pn-note">
                تخضع عمليات النقل عبر الحدود أيضًا لمتطلبات الترخيص أو التصريح لدى مركز حماية البيانات الشخصية المصري. Quest في مرحلة ما قبل الإطلاق ويجري استكمال هذا المسار التنظيمي قبل اعتبار هذا الإشعار نسخته القانونية النهائية.
              </p>
            </Section>

            <Section title="10. كم نحتفظ بالبيانات؟">
              <p>
                نحتفظ ببيانات الحساب الأساسية وبيانات Quest طالما كان حسابك قائمًا وبالقدر اللازم لتقديم الخدمة. قد نحتفظ ببعض السجلات التشغيلية أو الأمنية لمدة محدودة عندما تكون ضرورية للأمان، حل النزاعات أو الالتزامات القانونية.
              </p>
              <p>
                عند حذف الحساب، سنهدف إلى إزالة البيانات من الأنظمة النشطة، مع ملاحظة أن بعض النسخ الاحتياطية أو سجلات مزودي الخدمة قد تستمر حتى تنتهي دورة الاحتفاظ الخاصة بها. سنحدد سياسة الحذف الفنية النهائية قبل الإطلاق العام.
              </p>
            </Section>

            <Section title="11. حقوقك">
              <p>
                وفقًا للقانون المطبق، قد يكون لك الحق في معرفة كيفية استخدام بياناتك، الوصول إليها، تصحيحها، طلب حذفها، الاعتراض على بعض المعالجات، وسحب الموافقة عندما يكون الأساس هو الموافقة.
              </p>
              <p>
                لطلب ممارسة حق من هذه الحقوق، تواصل معنا على <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>. سنحتاج أحيانًا إلى التحقق من هويتك قبل تنفيذ الطلب.
              </p>
              <p>
                كما يحق لك تقديم شكوى إلى <a href="https://pdpc.gov.eg/" target="_blank" rel="noreferrer">مركز حماية البيانات الشخصية في مصر (PDPC)</a>.
              </p>
            </Section>

            <Section title="12. الأمان">
              <p>
                نستخدم المصادقة، صلاحيات الوصول على مستوى البيانات، HTTPS، وضوابط الأمان التي يوفرها مزودو البنية التحتية. لا توجد خدمة إنترنت يمكن ضمان أمانها بنسبة 100%، لذلك نراجع الضوابط الأمنية باستمرار مع نمو Quest.
              </p>
            </Section>

            <Section title="13. العمر">
              <p>
                النسخة العامة الأولى من Quest مخصصة للمستخدمين بعمر 18 عامًا أو أكثر. سنضيف خطوة تأكيد العمر إلى التسجيل قبل الإطلاق العام. إذا تغيرت هذه السياسة أو أطلقنا تجربة مخصصة للأصغر سنًا، فسنحدّث الإشعار ونطبق ضوابط موافقة ولي الأمر المطلوبة قبل ذلك.
              </p>
            </Section>

            <Section title="14. الميزات المدفوعة مستقبلًا">
              <p>
                Quest لا يعالج مدفوعات المستخدمين حاليًا. إذا أضفنا خطط Premium أو اشتراكات مدفوعة مستقبلًا، سنحدّث إشعار الخصوصية قبل جمع بيانات الفوترة، وسنوضح مزود الدفع والبيانات التي يستلمها ومدة الاحتفاظ بها. نهدف إلى ألا يحتفظ Quest نفسه ببيانات البطاقة الكاملة.
              </p>
            </Section>

            <Section title="15. تغييرات هذا الإشعار">
              <p>
                سنحدّث هذا الإشعار إذا تغيرت البيانات التي نجمعها أو أغراض الاستخدام أو مزودو الخدمة أو الميزات. عندما يكون التغيير مهمًا، سنعرض إشعارًا مناسبًا داخل Quest أو عبر وسيلة اتصال مناسبة قبل أو عند سريان التغيير حسب ما يقتضيه القانون.
              </p>
            </Section>

            <Section title="16. التواصل معنا">
              <p>
                لأي سؤال أو طلب متعلق بالخصوصية: <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>
              </p>
            </Section>
          </article>
        ) : (
          <article className="pn-content">
            <Section title="1. Who is responsible for your data?">
              <p>
                Quest is an independent pre-launch product operated from Egypt. Before public launch, this section will be completed with the full legal identity and required contact details of the operator.
              </p>
              <p><strong>Legal operator:</strong> Abdelrahman Mohamed Talaat Mohamed, an individual based in Egypt.</p>
              <p><strong>Privacy contact:</strong> <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a></p>
              <p>
                Quest has not appointed a separate Data Protection Officer at the pre-launch stage. If one is required or appointed later, the contact details will be added here.
              </p>
            </Section>

            <Section title="2. What information does Quest collect?">
              <DataTable rows={[
                ["Account information", "Email address, account identifier, username and display name."],
                ["Productivity information", "Quest names, tasks, anchors, goals, schedules, planned dates and times."],
                ["Progress information", "Completion status, XP, level, progression, rewards and reward claims."],
                ["Time and work information", "Estimated duration, actual duration, work timers, focus sessions and completion time."],
                ["Personal planning information", "Task-duration patterns, weekly plans, day adjustments and workload patterns."],
                ["Social information", "Your public Quest username, friendships, friend requests and their status."],
                ["Competition information", "Competition membership, XP, task counts, focus minutes, level and results."],
                ["Farm information", "Farm name, plants, discoveries, growth XP, care history and chests."],
                ["Notification information", "Notification preferences, timezone, push subscription and delivery information."],
                ["Technical information", "Session and sync information, operational records needed for security/reliability, and local browser data needed for offline operation."],
              ]} />
              <p className="pn-note">
                Task names are free text. Please do not place card numbers, government identifiers, passwords, medical diagnoses or other highly sensitive information in Quest unless it is genuinely necessary.
              </p>
            </Section>

            <Section title="3. Where does the information come from?">
              <p>
                Most information comes directly from you when you create an account, task, goal, friendship or competition. Some technical information is generated automatically when you use Quest, such as session, synchronization and push-notification information.
              </p>
            </Section>

            <Section title="4. Why do we use it, and on what legal basis?">
              <DataTable rows={[
                ["Provide your account and the service", "To sign you in, save Quest, synchronize data and provide features you request. We primarily rely on contractual necessity to provide the service."],
                ["Personalized planning", "To improve time estimates, day/week workload planning and your personal statistics as part of the service you request."],
                ["Friends and competitions", "To carry out friend requests, competitions and rankings when you use those features."],
                ["Security and reliability", "To protect accounts, investigate faults or abuse, and keep Quest reliable. We rely on legitimate interests that do not override your rights, and on legal obligations where applicable."],
                ["Optional notifications", "To send push notifications when you enable them. You can disable them in Quest or through your browser/device."],
                ["Legal requirements", "Where processing is necessary to comply with a legal obligation or a valid order from a competent authority."],
              ]} />
            </Section>

            <Section title="5. How personalization and “Quest AI” currently work">
              <p>
                As of this notice, Quest uses computational rules inside the product to learn from information such as task names/categories, estimated and actual duration, completion history and planning patterns. This is used to improve duration and workload estimates.
              </p>
              <p>
                The current feature does not send your task history to a general-purpose third-party AI model in order to generate these predictions. If that changes, we will update this notice before enabling the new processing and explain the provider, data sent and purpose.
              </p>
            </Section>

            <Section title="6. What can other Quest users see?">
              <p>
                Your username and display name may be visible to other signed-in Quest users through search, friend requests, friendships and competitions. Competition participants may see relevant XP, level, task counts, focus minutes and results depending on the competition.
              </p>
              <p>
                Your task names are private by default. If a competition type offers task-name sharing, names are shared only when the sharing option is enabled for that competition.
              </p>
            </Section>

            <Section title="7. Browser storage and cookies">
              <p>
                Quest uses necessary device/browser storage to maintain authentication, keep a local copy of Quest state when needed, support offline use and synchronize changes when the connection returns.
              </p>
              <p>
                Quest currently does not use Meta Pixel, TikTok Pixel, advertising cookies or similar marketing trackers. If we later introduce non-essential analytics or advertising technology, we will review and implement the required consent controls before enabling it.
              </p>
            </Section>

            <Section title="8. Service providers">
              <DataTable rows={[
                ["Supabase", "Authentication and database. Quest's current project is hosted in the eu-west-1 region in Ireland."],
                ["Vercel", "Application hosting, delivery and infrastructure. Processing may occur in the United States and other locations used by Vercel or its providers."],
                ["Resend", "Account confirmation, password recovery and transactional email. Resend currently stores its service data in the United States."],
                ["Browser/device push provider", "If you enable push notifications, delivery may pass through the push service used by your browser or operating system."],
              ]} />
              <p>We expect service providers to process data only as needed to provide their services and under their applicable contractual and security commitments.</p>
            </Section>

            <Section title="9. International transfers">
              <p>
                Quest currently relies on international infrastructure, so personal data may be transferred to, stored in or processed outside Egypt. Quest's primary Supabase database is currently in Ireland (eu-west-1). Resend stores its service data in the United States, and Vercel may process data in the United States and other locations used by Vercel or its providers.
              </p>
              <p>
                Before a new account is created, Quest asks for separate, explicit consent to this cross-border transfer and processing. You may later withdraw that consent by contacting us. Because Quest's current infrastructure depends on services outside Egypt, withdrawing this consent may mean we can no longer continue providing the account.
              </p>
              <p className="pn-note">
                Cross-border processing is also subject to Egyptian PDPC licensing or permit requirements. Quest is still pre-launch and is completing this regulatory step before this notice is treated as the final launch version.
              </p>
            </Section>

            <Section title="10. How long do we keep information?">
              <p>
                Core account and Quest data is generally kept while your account remains active and for as long as needed to provide the service. Some operational or security records may be kept for a limited period where needed for security, dispute handling or legal obligations.
              </p>
              <p>
                When an account is deleted, we intend to remove account data from active systems, although backups and provider logs may remain until their normal retention cycles expire. The final technical deletion and backup-retention procedure will be completed before public launch.
              </p>
            </Section>

            <Section title="11. Your privacy rights">
              <p>
                Depending on applicable law, you may have rights to understand how your information is used, access it, correct it, request deletion, object to certain processing and withdraw consent where consent is the legal basis.
              </p>
              <p>
                To exercise a privacy right, contact <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>. We may need to verify your identity before fulfilling a request.
              </p>
              <p>
                You also have the right to lodge a complaint with Egypt's <a href="https://pdpc.gov.eg/" target="_blank" rel="noreferrer">Personal Data Protection Center (PDPC)</a>.
              </p>
            </Section>

            <Section title="12. Security">
              <p>
                Quest uses authentication, data-access controls, HTTPS and security measures provided by our infrastructure providers. No internet service can guarantee absolute security, so we will continue reviewing security controls as Quest grows.
              </p>
            </Section>

            <Section title="13. Age">
              <p>
                Quest's initial public beta is intended for users aged 18 and over. An age-confirmation step will be added before public launch. If we later change this policy or build an experience for younger users, we will update this notice and implement any required guardian-consent safeguards first.
              </p>
            </Section>

            <Section title="14. Future paid features">
              <p>
                Quest does not currently process user payments. If we later introduce Premium plans or paid subscriptions, we will update this Privacy Notice before collecting billing information and explain the payment provider, information received and retention. Our goal is for Quest itself not to store full payment-card details.
              </p>
            </Section>

            <Section title="15. Changes to this notice">
              <p>
                We will update this notice when the information we collect, our purposes, service providers or features materially change. Where appropriate or required by law, we will provide an in-app or other appropriate notice before or when the change takes effect.
              </p>
            </Section>

            <Section title="16. Contact">
              <p>
                For privacy questions and requests: <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>
              </p>
            </Section>
          </article>
        )}

        <footer className="pn-footer">
          <a href="/">{isArabic ? "العودة إلى Quest" : "Return to Quest"}</a>
        </footer>
      </div>
    </main>
  );
}
