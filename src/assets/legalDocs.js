export const PrivacyPolicy = `
# Privacy Policy for HOPE Edu Hub

Welcome to HOPE Edu Hub! As an AI-native educational platform for engineering students, protecting your academic integrity and personal data is our primary mission. We believe in complete transparency about how your data powers our intelligent tutoring systems.

---

## 1. What Data We Collect
We collect data strictly necessary to provide an immersive and effective educational experience. This data falls into three categories:

- **Account Data:** Your Name, Email address, and Authentication Credentials.
- **Academic Context:** Educational details such as your current semester and department to tailor learning pathways.
- **AI Interaction Data:** The academic PDFs you upload, the code snippets you write, and your chat history with the AI Tutor.

## 2. How We Use the Data (The AI Clause)
HOPE Edu Hub uses cutting-edge artificial intelligence to generate podcasts, debug code snippets, and act as a personalized tutor. 

**Secure Real-Time Inference:**
When you upload PDFs or interact with the AI Tutor, your prompts and documents are processed securely in real-time. 
**We DO NOT train our own models on your personal data.** The data you submit is used strictly for in-the-moment AI context so the tutor can provide accurate assignment help or course material simplification.

**The Models Powering Your Education:**
Depending on the task (e.g., complex coding vs. quick chatting), we route your queries to highly capable models including **Llama-3.3-70B**, **Llama-3.1-8B**, **Mixtral-8x7B**, **Gemma2-9B**, and **Arcee-AI Trinity**. We utilize dynamic routing to ensure the best performance.

## 3. Third-Party Sharing and Infrastructure
We operate on a modern, secure cloud infrastructure. We **do not sell** your student data to advertisers or third-party brokers. However, evaluating your queries requires sharing data with our trusted infrastructure partners:

- **Supabase:** We use Supabase to securely host our database and manage user authentication. Your account data and chat histories are safely encrypted here.
- **Puter.js & Groq:** We use Puter.js and the Groq API for lightning-fast cloud AI inference. When you ask a question or upload a document, text is securely routed through these services to reach the AI models mentioned above.

## 4. Data Retention and Control
We believe your data is yours to manage.
- **Chat Histories:** Your chat interactions and generated materials (like podcasts) are saved so you can resume your studies anytime. 
- **User Control:** You can clear your chat history directly from the AI Tutor interface at any time.

## 5. Your User Rights
Under modern privacy principles (including GDPR and DPDP concepts), you have the right to:
- Access the data we have stored about your profile.
- Request the deletion of your account and all associated data.
- Withdraw your consent at any time by deleting your account.

## 6. Security & Academic Integrity
We use encrypted cloud storage (via Supabase) and secure API routing to protect your data from unauthorized access, ensuring that your ideas, code, and academic records remain entirely your own.

*By using HOPE Edu Hub, you consent to these practices designed to supercharge your engineering education safely.*
`;

export const UserAgreement = `
# User Agreement & Terms of Service (ToS)

Welcome to HOPE Edu Hub. By accessing or using our platform, you agree to be bound by these functional rules designed to keep our educational community safe, fair, and effective. 

**TL;DR:** Use HOPE Edu Hub to learn, not to cheat. Don't hack the platform, don't spam the AI, and remember that AI makes mistakes—so double-check your work. Using this platform means you agree to these terms.

---

## 1. Acceptance of Terms & Account Security
By signing into HOPE Edu Hub, uploading documents, or interacting with our AI tools, you legally agree to these Terms of Service. If you do not agree, do not use the platform.
**TL;DR:** Logging in means you agree to these rules. Keep your password safe.

- **Account Security:** You are strictly responsible for maintaining the confidentiality of your Supabase authentication credentials and Secret UID. You are responsible for all activities that occur under your account. If you suspect someone else is using your account, notify us immediately.

## 2. Academic Integrity
HOPE Edu Hub provides advanced tools like the J-Compiler, Podcast Classes, Zero to Hero, and Seminar Generators. These are designed as *educational aids* to enhance your learning, not to do your work for you.
**TL;DR:** Do not use our AI to cheat on exams or plagiarize assignments.

- **No Academic Fraud:** You explicitly agree NOT to use our AI tools to commit academic fraud, cheat on university exams, or violate your specific institution's honor code or plagiarism policies.
- **Enforcement:** We reserve the right to ban users who are found to be abusing the platform for academic misconduct.

## 3. AI Limitations and "As-Is" Disclaimer
Generative AI is powerful, but it hallucinates, makes logical errors, and occasionally writes buggy code.
**TL;DR:** AI makes mistakes. We aren't responsible if you fail a test or crash a server because you trusted AI output blindly.

- **No Warranties:** All AI output (including code audits, podcast summaries, handbook notes, and generated slides) is provided strictly "AS IS" and "AS AVAILABLE" without any warranty of accuracy, reliability, or correctness.
- **Assumption of Risk:** You assume 100% of the educational and professional risk if you rely on AI-generated content for exams, technical interviews, or project execution. HOPE Edu Hub is not liable for academic failure, bugs in generated code, or factual inaccuracies.

## 4. Intellectual Property (IP)
You own your stuff; we own our stuff.
**TL;DR:** Don't upload copyrighted textbooks you don't own. You own the prompts you write and the specific code you generate, but AI might give someone else the exact same answer.

- **Your Inputs:** You retain ownership of the original PDFs, class notes, and code snippets you upload. By uploading them, you warrant that you have the legal right to do so (e.g., you aren't uploading a professor's copyrighted textbook without permission).
- **AI Outputs:** To the extent permitted by law, you own the Output generated by your specific prompts. However, due to the statistical nature of machine learning, outputs may not be highly unique. Other students asking similar questions might receive identical or similar code and text.

## 5. Prohibited Conduct & Rate Limiting
We want this platform to be fast and free for engineering students, which means we can't afford malicious attacks or API scraping.
**TL;DR:** Don't try to hack or crash the system, and don't spam the AI endpoints.

- **Restrictions:** You agree not to:
  1. Reverse-engineer our AI system prompts or the "J-Compiler."
  2. Attempt to bypass security constraints, Rate Limits, or inject malicious code (e.g., SQL injections or XSS).
  3. Use automated bots or scripts to scrape data or abuse our inference endpoints (Puter.js / Groq).
- **Throttling:** We reserve the right to throttle (rate-limit) or temporarily suspend accounts that spam the AI or abuse the resources.

## 6. Indemnification (User Liability)
**TL;DR:** If your actions get us sued, you have to cover the legal bills.

- You agree to indemnify, defend, and hold harmless HOPE Edu Hub, its founders, and its partners (e.g., Supabase) from any claims, damages, or legal costs arising from:
  1. Your upload of copyrighted material without permission.
  2. Software bugs or copyright infringement resulting from your use of AI-generated code.
  3. Academic disciplinary actions brought against you by your university.

## 7. Termination of Service
**TL;DR:** We can kick you off the platform if you break the rules.

- We reserve the right to terminate or suspend your access to HOPE Edu Hub at any time, with or without cause, and without prior notice, especially in cases of Terms violations or API abuse.

*Enjoy learning, stay curious, and build great things with HOPE Edu Hub!*
`;
