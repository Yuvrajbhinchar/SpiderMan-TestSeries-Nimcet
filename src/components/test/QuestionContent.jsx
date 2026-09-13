"use client";

export default function QuestionContent({
  question,
}) {
  if (!question) {
    return null;
  }

  const imageUrl =
    String(
      question.questionImageUrl ||
        question.question_image_url ||
        ""
    ).trim();

  const questionText =
    String(
      question.questionText ||
        question.question_text ||
        ""
    ).trim();

  return (
    <div className="w-full">
      {imageUrl ? (
        <div className="mb-7 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <img
            src={imageUrl}
            alt={`Question ${
              question.questionNumber ||
              question.number ||
              question.questionOrder ||
              ""
            }`}
            loading="eager"
            decoding="async"
            draggable={false}
            onContextMenu={(event) =>
              event.preventDefault()
            }
            className="block h-auto max-h-[720px] w-full object-contain select-none"
          />
        </div>
      ) : null}

      {questionText ? (
        <div className="whitespace-pre-wrap text-[20px] leading-8 tracking-[-0.01em] text-slate-800 sm:text-[22px]">
          {questionText}
        </div>
      ) : null}

      {!imageUrl &&
      !questionText ? (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
          Question content is unavailable.
        </div>
      ) : null}
    </div>
  );
}