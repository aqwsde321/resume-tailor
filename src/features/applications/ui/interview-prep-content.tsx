import type { ApplicationInterviewPrep } from "@/entities/application/model/interview-prep";

export function InterviewPrepContent({ prep }: { prep: ApplicationInterviewPrep }) {
  return <>
    <p className="application-artifact-date">{new Date(prep.generatedAt).toLocaleString("ko-KR")} 생성</p>
    <section>
      <h3>면접 시작 30초 소개</h3>
      <p>{prep.openingPitch}</p>
    </section>
    <section>
      <h3>예상 질문과 답변 개요</h3>
      <ol className="application-interview-questions">
        {prep.questions.map((question, index) => <li key={`${question.question}-${index}`}>
          <h4>{question.question}</h4>
          <p><strong>확인 포인트:</strong> {question.focus}</p>
          <p><strong>이력서 근거:</strong> {question.resumeEvidence}</p>
          <ol>{question.answerOutline.map((step, stepIndex) => <li key={`${step}-${stepIndex}`}>{step}</li>)}</ol>
        </li>)}
      </ol>
    </section>
    <section>
      <h3>회사에 물어볼 질문</h3>
      <ul>{prep.questionsToAsk.map((question, index) => <li key={`${question}-${index}`}>{question}</li>)}</ul>
    </section>
  </>;
}
