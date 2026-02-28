import { useState, useEffect } from 'react';
import { compatibilityAPI, CompatibilityQuestion, CompatibilityAnswer } from '../../api/compatibility';
import './Widget.css';

interface CompatibilityQuizProps {
  onComplete: () => void;
}

const CompatibilityQuiz = ({ onComplete }: CompatibilityQuizProps) => {
  const [questions, setQuestions] = useState<CompatibilityQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<CompatibilityAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      const response = await compatibilityAPI.getQuestions();
      setQuestions(response.questions);
    } catch (err) {
      console.error('Failed to load questions', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (answer: string | number) => {
    const newAnswers = [...answers];
    const questionId = questions[currentQuestion].id;
    const existingIndex = newAnswers.findIndex(a => a.questionId === questionId);
    
    if (existingIndex !== -1) {
      newAnswers[existingIndex].answer = answer;
    } else {
      newAnswers.push({ questionId, answer });
    }
    
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleSubmit = async () => {
    if (answers.length !== questions.length) {
      alert('Please answer all questions');
      return;
    }

    setSubmitting(true);
    try {
      await compatibilityAPI.submitQuiz(answers);
      onComplete();
    } catch (err) {
      console.error('Failed to submit quiz', err);
      alert('Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>Loading quiz...</div>;
  }

  if (questions.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>No questions available</div>;
  }

  const question = questions[currentQuestion];
  const currentAnswer = answers.find(a => a.questionId === question.id);

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>
            Question {currentQuestion + 1} of {questions.length}
          </span>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>
            {Math.round(((currentQuestion + 1) / questions.length) * 100)}%
          </span>
        </div>
        <div style={{ width: '100%', height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${((currentQuestion + 1) / questions.length) * 100}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #ff6b9d, #c44569)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      <h3 style={{ marginBottom: '20px', fontSize: '20px' }}>{question.question}</h3>

      {question.type === 'multiple_choice' && question.options && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {question.options.map((option, idx) => (
            <button
              key={idx}
              onClick={() => handleAnswer(option)}
              className={currentAnswer?.answer === option ? 'select-user-btn' : 'back-btn'}
              style={{ width: '100%', padding: '12px', textAlign: 'left' }}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {question.type === 'scale' && (
        <div style={{ padding: '20px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span>Not Important</span>
            <span>Very Important</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={typeof currentAnswer?.answer === 'number' ? currentAnswer.answer : 50}
            onChange={(e) => handleAnswer(parseInt(e.target.value))}
            style={{ width: '100%' }}
          />
          <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '18px', fontWeight: 'bold' }}>
            {typeof currentAnswer?.answer === 'number' ? currentAnswer.answer : 50}
          </div>
        </div>
      )}

      {question.type === 'yes_no' && (
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => handleAnswer('yes')}
            className={currentAnswer?.answer === 'yes' ? 'select-user-btn' : 'back-btn'}
            style={{ flex: 1, padding: '12px' }}
          >
            Yes
          </button>
          <button
            onClick={() => handleAnswer('no')}
            className={currentAnswer?.answer === 'no' ? 'select-user-btn' : 'back-btn'}
            style={{ flex: 1, padding: '12px' }}
          >
            No
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
        <button
          onClick={handlePrevious}
          className="back-btn"
          disabled={currentQuestion === 0}
          style={{ flex: 1 }}
        >
          Previous
        </button>
        {currentQuestion < questions.length - 1 ? (
          <button
            onClick={handleNext}
            className="select-user-btn"
            disabled={!currentAnswer}
            style={{ flex: 1 }}
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            className="select-user-btn"
            disabled={!currentAnswer || submitting}
            style={{ flex: 1 }}
          >
            {submitting ? 'Submitting...' : 'Submit Quiz'}
          </button>
        )}
      </div>
    </div>
  );
};

export default CompatibilityQuiz;



