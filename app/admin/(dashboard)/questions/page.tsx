import { requireAdmin } from "@/lib/admin-auth";
import { loadEditableBank } from "@/lib/assessment/question-bank";
import { QuestionEditorBlock } from "@/components/admin/question-editor-block";

export const dynamic = "force-dynamic";

/**
 * The hiring team's window into the question bank.
 *
 * Every save publishes a new version rather than editing in place, so a wording fix cannot rewrite
 * what an in-flight candidate is reading or what a filed record says the candidate was asked.
 */
export default async function AdminQuestionsPage() {
  await requireAdmin();

  const { version, questions } = await loadEditableBank();

  return (
    <main className="flex-1 px-5 py-8 md:px-7">
      <div className="max-w-[52rem]">
        <h2 className="text-[1.5rem] leading-[1.2] font-medium tracking-[-0.02em] md:text-[1.7rem]">
          Question bank
        </h2>
        <p className="mt-2 text-[13.5px] leading-[1.55] text-soft">
          Currently published as{" "}
          <span className="mono text-[12.5px] text-ink">version {version}</span>. Saving a question
          publishes a new version of the whole bank: candidates who have already started — and every
          filed record — keep the wording they were shown; new candidates see the edit.
        </p>
      </div>

      {questions.length === 0 ? (
        <div className="mt-7 border border-rule bg-paper/60 px-5 py-6">
          <p className="text-[14px] leading-[1.6] text-ink">
            This bank has no published rows to edit. Run{" "}
            <span className="mono text-[13px]">npm run db:seed</span> to publish the authored
            questions, then reload this page.
          </p>
        </div>
      ) : (
        <div className="mt-7 grid grid-cols-1 gap-5 xl:grid-cols-2">
          {questions.map((question) => (
            <QuestionEditorBlock key={question.key} question={question} />
          ))}
        </div>
      )}

      <p className="mt-8 text-[12.5px] leading-[1.6] text-soft">
        Option order, letters and scoring stay fixed — an edit changes wording only. The Question 21
        tool inventory and its follow-ups are not managed here.
      </p>
    </main>
  );
}

export const metadata = {
  title: "Questions · AI Engineering Developer Assessment",
  robots: { index: false, follow: false },
};
