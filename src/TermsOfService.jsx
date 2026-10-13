import { useMemo, useState } from "react";
import "./privacy-notice.css";

const UPDATED = "6 October 2026";
const SUPPORT_EMAIL = "support@myquests.me";
const PRIVACY_EMAIL = "privacy@myquests.me";

function Section({ title, children }) {
  return (
    <section className="pn-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default function TermsOfService() {
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
            {isArabic
              ? "شروط النسخة التجريبية العامة — قد يتم تحديثها مع تطور Quest"
              : "PUBLIC BETA TERMS — may be updated as Quest develops"}
          </div>

          <h1>{isArabic ? "شروط الاستخدام" : "Terms of Service"}</h1>
          <p className="pn-updated">
            {isArabic ? `آخر تحديث: ${UPDATED}` : `Last updated: ${UPDATED}`}
          </p>

          <div className="pn-summary">
            <strong>{isArabic ? "Quest يساعدك في رحلتك، لكن حسابك ومسؤولياتك تظل لك." : "Quest helps with the journey, but your account and choices remain yours."}</strong>
            <p>
              {isArabic
                ? "تنظم هذه الشروط استخدامك لـ Quest و myquests.me. بإنشاء حساب أو استخدام Quest، فإنك توافق على هذه الشروط."
                : "These Terms govern your use of Quest and myquests.me. By creating an account or using Quest, you agree to these Terms."}
            </p>
          </div>
        </header>

        {isArabic ? (
          <article className="pn-content">
            <Section title="1. من يمكنه استخدام Quest؟">
              <p>
                Quest مخصص حاليًا للأشخاص الذين يبلغون 18 عامًا أو أكثر. بإنشاء حساب، تؤكد أنك تبلغ 18 عامًا على الأقل. يجب أن تقدم معلومات حساب صحيحة وألا تنشئ حسابًا بانتحال هوية شخص آخر.
              </p>
            </Section>

            <Section title="2. ما هو Quest؟">
              <p>
                Quest تطبيق للإنتاجية والتخطيط الشخصي يستخدم Quests وDaily Anchors وXP والمستويات والمزرعة والمكافآت والإحصائيات والأصدقاء والتحديات وغيرها من الميزات ذات الطابع التفاعلي لمساعدتك على تنظيم أهدافك وإنجازها. قد نضيف ميزات أو نغيرها أو نزيلها أو نجرب أفكارًا جديدة مع تطور المنتج.
              </p>
            </Section>

            <Section title="3. حالة النسخة التجريبية">
              <p>
                Quest منتج يتطور باستمرار. قد تحتوي بعض الميزات على أخطاء، أو تتغير بشكل كبير، أو تتوقف مؤقتًا، أو تتم إزالتها. سنحاول الحفاظ على موثوقية الخدمة، لكننا لا نضمن أنها ستكون متاحة دون انقطاع أو خالية تمامًا من الأخطاء.
              </p>
            </Section>

            <Section title="4. حسابك">
              <p>
                أنت مسؤول عن الحفاظ على أمان بيانات تسجيل الدخول وعن النشاط الذي يتم من خلال حسابك. لا تشارك كلمة المرور مع الآخرين. إذا اعتقدت أن حسابك تعرض للاختراق، تواصل معنا عبر <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
              </p>
              <p>
                قد نقيد الحساب أو نعلقه عندما يكون ذلك ضروريًا بصورة معقولة لحماية Quest أو المستخدمين الآخرين أو أمان الخدمة.
              </p>
            </Section>

            <Section title="5. بياناتك وخصوصيتك">
              <p>
                يوضح <a href="/privacy?lang=ar">إشعار الخصوصية</a> كيف نجمع البيانات الشخصية ونستخدمها. استخدام Quest لا يمنح Quest ملكية بياناتك الشخصية.
              </p>
              <p>
                يمكنك حذف حسابك نهائيًا من داخل Quest. حذف الحساب يختلف عن Restart Account، الذي يعيد ضبط تقدمك مع إبقاء الحساب قائمًا.
              </p>
            </Section>

            <Section title="6. المحتوى الذي تنشئه">
              <p>
                تظل مالكًا للمحتوى الذي تنشئه داخل Quest، مثل أسماء المهام والـQuests والأهداف وأسماء المنافسات وغيرها من المعلومات التي تدخلها.
              </p>
              <p>
                تمنح Quest إذنًا محدودًا لتخزين هذا المحتوى ومعالجته وعرضه ونقله فقط بالقدر اللازم لتشغيل الخدمة وتحسينها. ينتهي هذا الإذن عند حذف المحتوى، مع مراعاة فترات الاحتفاظ التقنية المعقولة للنسخ الاحتياطية والسجلات.
              </p>
            </Section>

            <Section title="7. المحتوى الخاص والمشترك">
              <p>
                بيانات إنتاجيتك خاصة افتراضيًا ما لم توضح ميزة معينة في Quest أنها تسمح لك بمشاركة شيء أو تطلب منك ذلك. على سبيل المثال، قد تسمح بعض المنافسات بمشاركة معلومات معينة عن المهام مع المشاركين الآخرين. سنوضح عندما تكون معلومات معينة قابلة للمشاركة.
              </p>
            </Section>

            <Section title="8. الأصدقاء والمنافسات والميزات الاجتماعية">
              <p>
                صممت المنافسات والتحديات في Quest لتحفيز الإنتاجية والمنافسة الودية. لا يجوز استخدام هذه الميزات للتحرش أو التهديد أو انتحال الشخصية أو المطاردة أو الاحتيال أو الإضرار المتعمد بشخص آخر.
              </p>
              <p>
                لا يجوز التلاعب بـXP أو استغلال الأخطاء أو استخدام الأتمتة لتزوير التقدم أو إنشاء حسابات وهمية للتأثير على المنافسات أو الغش في النظام بأي طريقة أخرى. قد يزيل Quest مستخدمين من المنافسات أو يتخذ إجراءات ضد الحسابات عند اكتشاف إساءة استخدام أو تلاعب.
              </p>
            </Section>

            <Section title="9. عدم استخدام Quest للمقامرة">
              <p>
                منافسات Quest هي تحديات إنتاجية وليست خدمات مقامرة. لا يقدم Quest حاليًا رهانات أو مراهنات أو ألعاب حظ بمقابل مالي.
              </p>
              <p>
                إذا سمحت ميزة للمستخدمين بذكر جوائز غير رسمية بينهم، فإن Quest لا يجمع هذه الجوائز أو يحتفظ بها أو يضمنها أو يفرض تنفيذها ما لم يذكر Quest صراحة خلاف ذلك.
              </p>
            </Section>

            <Section title="10. الاستخدام المقبول">
              <p>
                لا يجوز استخدام Quest لانتهاك القانون، أو مهاجمة البنية التحتية للخدمة أو تعطيلها، أو محاولة الوصول إلى بيانات مستخدم آخر، أو نشر برمجيات ضارة، أو التحايل على أنظمة الأمان، أو إساءة استخدام حدود الخدمات أو الواجهات البرمجية، أو انتحال شخص آخر، أو إرسال رسائل مزعجة، أو استخدام Quest بطريقة تسبب ضررًا جسيمًا للمستخدمين أو المنصة.
              </p>
              <p>الاستخدام الشخصي العادي والتجربة المعقولة للمنتج مسموحان. هذا البند موجه لمنع إساءة الاستخدام وليس لتقييد الاستخدام الطبيعي.</p>
            </Section>

            <Section title="11. الملكية الفكرية الخاصة بـ Quest">
              <p>
                العلامة التجارية لـQuest، والتصميمات البصرية، والواجهة، والأعمال الفنية، وأنظمة اللعبة، والرسومات الأصلية، والكود المصدري، والمواد الأخرى المنشأة لـQuest تعود ملكيتها إلى أصحابها أو الجهات المرخصة لها وتتمتع بالحماية حيثما ينطبق القانون.
              </p>
              <p>
                استخدام Quest لا يمنحك حق نسخ هذه المواد أو إعادة بيعها أو توزيعها أو استغلالها تجاريًا دون إذن. ولا يؤثر هذا على ملكيتك للمحتوى الذي تنشئه بنفسك داخل Quest.
              </p>
            </Section>

            <Section title="12. خدمات الأطراف الثالثة">
              <p>
                يعتمد Quest على مزودي خدمات للبنية التحتية، مثل الاستضافة وقواعد البيانات والمصادقة والبريد الإلكتروني. قد تتعرض هذه الخدمات أحيانًا لانقطاعات أو مشكلات خارجة عن سيطرتنا. سنحاول استعادة التشغيل الطبيعي عند حدوث ذلك، لكننا لسنا مسؤولين عن الأعطال التي تنتج بالكامل عن بنية تحتية تابعة لطرف ثالث.
              </p>
            </Section>

            <Section title="13. ميزات Premium المستقبلية">
              <p>
                Quest متاح حاليًا دون اشتراك مدفوع. إذا أضفنا خطط Premium أو ميزات مدفوعة مستقبلًا، فسيتم توضيح السعر ودورة الفوترة والتجديد والإلغاء وأي شروط استرداد قبل الشراء.
              </p>
              <p>
                لن نحول الحساب المجاني سرًا إلى اشتراك مدفوع. سنحدّث الشروط المادية المتعلقة بالدفع قبل إطلاق الميزات المدفوعة.
              </p>
            </Section>

            <Section title="14. التغييرات على Quest">
              <p>
                قد نقوم بتحسين الميزات أو إعادة تصميمها أو استبدالها أو إيقافها. عندما يؤثر تغيير بشكل جوهري على حقوق المستخدمين أو التزاماتهم، سنقدم إشعارًا مناسبًا حيثما يكون ذلك مطلوبًا أو مناسبًا.
              </p>
              <p>
                قد تتغير قيم XP وتوازن النظام وآليات المزرعة والمكافآت وغيرها من أنظمة الإنتاجية والتلعيب مع تطور Quest.
              </p>
            </Section>

            <Section title="15. التعليق وإنهاء الاستخدام">
              <p>
                قد نقيد أو نعلق أو ننهي الوصول عندما يخالف المستخدم هذه الشروط بشكل خطير أو متكرر، أو يسيء إلى مستخدمين آخرين، أو يعرض الأمان للخطر، أو يغش أنظمة المنصة، أو يستخدم Quest بصورة غير قانونية.
              </p>
              <p>
                قد نقدم تحذيرًا أولًا عندما يكون ذلك مناسبًا، ولكن يجوز اتخاذ إجراء فوري في حالات الأمان أو الاحتيال أو السلامة الجسيمة. ويمكن للمستخدم التوقف عن استخدام Quest أو حذف حسابه في أي وقت.
              </p>
            </Section>

            <Section title="16. لا يقدم Quest نصيحة مهنية">
              <p>
                Quest أداة إنتاجية ولا يقدم نصائح طبية أو نفسية أو مالية أو قانونية أو أي نصائح مهنية أخرى. توصيات الإنتاجية وتقديرات عبء العمل والتوقيت وميزات التخصيص مخصصة للمساعدة في التخطيط فقط.
              </p>
            </Section>

            <Section title="17. Quest AI والتخصيص">
              <p>
                قد يحلل Quest معلومات مثل مدة المهام وأنماط الإنجاز وعبء العمل ليقدم تقديرات واقتراحات تخطيط شخصية. هذه الاقتراحات ليست ضمانات. تظل أنت المسؤول عن تحديد المهام التي تنفذها وكيف تنظم وقتك.
              </p>
              <p>
                سنحرص على ألا نصف ميزات Quest AI أو نسوق لها باعتبارها تفهم أو تتنبأ بأكثر مما تقوم به فعليًا.
              </p>
            </Section>

            <Section title="18. حدود المسؤولية">
              <p>
                نهدف إلى تقديم خدمة موثوقة، لكن Quest يقدم على أساس "كما هو متاح". وإلى الحد الذي يسمح به القانون، لا يكون Quest مسؤولًا عن الخسائر غير المباشرة الناتجة عن أمور مثل المهام الفائتة، أو فقدان streak، أو قرارات الإنتاجية، أو الانقطاعات المؤقتة، أو وعود الجوائز بين المستخدمين، أو الاعتماد على تقديرات التطبيق.
              </p>
              <p>
                لا يقصد بأي شيء في هذه الشروط استبعاد حقوق أو مسؤوليات لا يجوز قانونًا استبعادها.
              </p>
            </Section>

            <Section title="19. الأمان">
              <p>
                نستخدم إجراءات تقنية وتنظيمية معقولة لحماية الخدمة، لكن لا يوجد نظام متصل بالإنترنت يمكنه ضمان الأمان الكامل. استخدم كلمة مرور قوية وأبلغنا إذا اعتقدت أن حسابك تعرض للاختراق.
              </p>
            </Section>

            <Section title="20. التغييرات على هذه الشروط">
              <p>
                قد نقوم بتحديث هذه الشروط مع تطور Quest. إذا كان التغيير جوهريًا، فقد نخبر المستخدمين داخل Quest أو عبر البريد الإلكتروني أو باستخدام وسيلة مناسبة أخرى. ستعرض الشروط دائمًا أحدث تاريخ سريان.
              </p>
            </Section>

            <Section title="21. القانون الحاكم">
              <p>
                تخضع هذه الشروط لقوانين جمهورية مصر العربية، مع مراعاة أي حقوق إلزامية تمنحها القوانين السارية للمستخدمين ولا يجوز التنازل عنها.
              </p>
            </Section>

            <Section title="22. التواصل">
              <p>
                للدعم العام أو الأسئلة المتعلقة بهذه الشروط: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
              </p>
              <p>
                لطلبات الخصوصية: <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>
              </p>
              <p>
                <strong>المشغّل:</strong> عبدالرحمن محمد طلعت محمد، بصفته فردًا مقيمًا في مصر.
              </p>
            </Section>
          </article>
        ) : (
          <article className="pn-content">
            <Section title="1. Who can use Quest?">
              <p>
                Quest is currently intended only for people who are 18 years old or older. By creating an account, you confirm that you are at least 18. You must provide accurate account information and must not create an account using someone else's identity.
              </p>
            </Section>

            <Section title="2. What is Quest?">
              <p>
                Quest is a productivity and personal-planning application that uses quests, daily anchors, XP, levels, farms, rewards, statistics, friends, challenges and other gamified features to help users organize and complete their goals. Quest may change, add, remove or experiment with features as the product develops.
              </p>
            </Section>

            <Section title="3. Beta status">
              <p>
                Quest is an evolving product. Features may contain bugs, change significantly, become temporarily unavailable or be removed. We will try to keep the service reliable, but we do not promise uninterrupted or error-free availability.
              </p>
            </Section>

            <Section title="4. Your account">
              <p>
                You are responsible for keeping your login credentials secure and for activity performed through your account. Do not share your password with another person. If you believe your account has been compromised, contact <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
              </p>
              <p>
                We may restrict or suspend an account where reasonably necessary to protect Quest, other users or the security of the service.
              </p>
            </Section>

            <Section title="5. Your data and privacy">
              <p>
                Our collection and use of personal information is explained separately in the <a href="/privacy?lang=en">Quest Privacy Notice</a>. Using Quest does not mean you give Quest ownership of your personal information.
              </p>
              <p>
                You can permanently delete your account through Quest. Account deletion is separate from Restart Account, which only resets your progress while keeping the account.
              </p>
            </Section>

            <Section title="6. Your content">
              <p>
                You keep ownership of content you create in Quest, such as task names, quest names, goals, competition names and other information you enter.
              </p>
              <p>
                You give Quest a limited permission to store, process, display and transmit that content only as necessary to operate and improve the service. This permission ends when the content is deleted, subject to reasonable technical backup and logging periods.
              </p>
            </Section>

            <Section title="7. Private and shared content">
              <p>
                Your productivity information is private by default unless a Quest feature clearly allows or asks you to share something. For example, a competition may allow participants to share certain task information with other participants. Quest should clearly indicate when information will be shared.
              </p>
            </Section>

            <Section title="8. Friends, competitions and social features">
              <p>
                Quest's competitions and challenges are intended to motivate productivity and friendly competition. Users must not use these features to harass, threaten, impersonate, stalk, scam or deliberately harm another person.
              </p>
              <p>
                You may not manipulate XP, exploit bugs, use automation to falsify progress, create fake accounts to influence competitions, or otherwise cheat the system. Quest may remove users from competitions or take action against accounts where abuse or manipulation is detected.
              </p>
            </Section>

            <Section title="9. No gambling">
              <p>
                Quest competitions are productivity challenges, not gambling services. Quest does not currently offer paid-entry betting, wagering, casinos or games of chance involving money.
              </p>
              <p>
                If users are allowed to describe informal prizes between themselves, Quest is not responsible for collecting, holding, guaranteeing or enforcing those prizes unless Quest explicitly says otherwise.
              </p>
            </Section>

            <Section title="10. Acceptable use">
              <p>
                You may not use Quest to break the law, attack or interfere with Quest's infrastructure, attempt to access another user's data, distribute malware, circumvent security systems, abuse API or service limits, impersonate another person, spam users, or use the service in a way that seriously harms other users or the platform.
              </p>
              <p>Reasonable experimentation and ordinary personal use are fine. This section is aimed at abuse, not at restricting normal use of Quest.</p>
            </Section>

            <Section title="11. Quest's intellectual property">
              <p>
                Quest's branding, visual designs, interface, artwork, game systems, original graphics, source code and other materials created for Quest belong to their respective owner or licensors and are protected where applicable.
              </p>
              <p>
                Using Quest does not give you the right to copy, resell, redistribute or commercially reproduce those materials without permission. This does not transfer ownership of the content you personally create inside Quest.
              </p>
            </Section>

            <Section title="12. Third-party services">
              <p>
                Quest relies on service providers such as hosting, databases, authentication and email providers. Those services may occasionally experience outages or other problems outside our control. Quest is not responsible for failures caused entirely by third-party infrastructure, although we will try to restore normal operation when possible.
              </p>
            </Section>

            <Section title="13. Future Premium features">
              <p>
                Quest is currently available without a paid subscription. If Premium plans or other paid features are introduced later, the applicable price, billing period, renewal rules, cancellation process and any refund conditions will be shown before a user purchases them.
              </p>
              <p>
                We will not silently convert a free account into a paid subscription. Material payment terms will be updated before paid features are launched.
              </p>
            </Section>

            <Section title="14. Changes to Quest">
              <p>
                We may improve, redesign, replace or discontinue features. Where a change materially affects users' rights or obligations, we will provide reasonable notice where appropriate.
              </p>
              <p>
                XP values, game balancing, farm mechanics, reward systems and similar gameplay and productivity mechanics may be adjusted as Quest evolves.
              </p>
            </Section>

            <Section title="15. Suspension and termination">
              <p>
                We may suspend or terminate access where a user seriously or repeatedly violates these Terms, abuses other users, compromises security, cheats platform systems or uses Quest unlawfully.
              </p>
              <p>
                Where appropriate, we may give a warning first, but immediate action may be taken for serious security, fraud or safety issues. Users may stop using Quest at any time and may delete their account.
              </p>
            </Section>

            <Section title="16. No professional advice">
              <p>
                Quest is a productivity tool. It does not provide medical, psychological, financial, legal or other professional advice. Productivity recommendations, workload estimates, timing predictions and Quest's personalization features are intended as planning assistance only.
              </p>
            </Section>

            <Section title="17. Quest AI and personalization">
              <p>
                Quest may analyze information such as your task durations, completion patterns and workload to provide personalized estimates and planning suggestions. These suggestions are not guarantees. You remain responsible for deciding what tasks to perform and how to organize your time.
              </p>
              <p>
                Quest should not market these features as understanding or predicting more than they actually do.
              </p>
            </Section>

            <Section title="18. Limitation of responsibility">
              <p>
                We aim to build a reliable service, but Quest is provided on an "as-available" basis. To the extent permitted by applicable law, Quest is not responsible for indirect losses caused by things such as missed tasks, lost streaks, productivity decisions, temporary outages, user-created competition promises or reliance on estimates produced by the app.
              </p>
              <p>
                Nothing in these Terms is intended to exclude rights or responsibilities that cannot legally be excluded.
              </p>
            </Section>

            <Section title="19. Security">
              <p>
                We use reasonable technical and organizational measures to protect the service, but no online system can guarantee complete security. Users should use a strong password and notify us if they believe their account has been compromised.
              </p>
            </Section>

            <Section title="20. Changes to these Terms">
              <p>
                We may update these Terms as Quest develops. If a change is material, we may notify users inside Quest, by email or through another reasonable method. The Terms will show their latest effective date.
              </p>
            </Section>

            <Section title="21. Governing law">
              <p>
                These Terms are intended to be governed by the laws of Egypt, subject to any mandatory rights that apply to users under applicable law.
              </p>
            </Section>

            <Section title="22. Contact">
              <p>
                General support and Terms questions: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
              </p>
              <p>
                Privacy requests: <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>
              </p>
              <p>
                <strong>Operator:</strong> Abdelrahman Mohamed Talaat Mohamed, an individual based in Egypt.
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
