import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { paymentAPI } from '../api/improvement';
import './Checkout.css';

// Stripe will be initialized with actual key from environment
// For development, you can use test keys from Stripe dashboard
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '');

const CheckoutForm = () => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [booking, setBooking] = useState<any>(null);

  useEffect(() => {
    const pending = localStorage.getItem('pendingBooking');
    if (!pending) {
      navigate('/home');
      return;
    }
    setBooking(JSON.parse(pending));
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || !booking) return;

    setLoading(true);
    setError('');

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message || 'Payment failed');
        setLoading(false);
        return;
      }

      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/home?payment=success`,
        },
        redirect: 'if_required',
      });

      if (confirmError) {
        setError(confirmError.message || 'Payment failed');
      } else {
        // Confirm payment on backend
        await paymentAPI.confirmPayment(booking.booking.id, booking.paymentIntentId);
        localStorage.removeItem('pendingBooking');
        navigate('/home?payment=success');
      }
    } catch (err: any) {
      setError(err.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  if (!booking) {
    return <div>Loading...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="checkout-form">
      <h2>Complete Payment</h2>
      <div className="booking-summary">
        <h3>Booking Summary</h3>
        <p><strong>Amount:</strong> ${booking.booking.amount.toFixed(2)}</p>
        <p><strong>Duration:</strong> {booking.booking.duration} minutes</p>
        <p><strong>Category:</strong> {booking.booking.category}</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="payment-section">
        <PaymentElement />
      </div>

      <button
        type="submit"
        disabled={!stripe || loading}
        className="pay-button"
      >
        {loading ? 'Processing...' : `Pay $${booking.booking.amount.toFixed(2)}`}
      </button>
    </form>
  );
};

const Checkout = () => {
  const [clientSecret, setClientSecret] = useState<string>('');

  useEffect(() => {
    const pending = localStorage.getItem('pendingBooking');
    if (pending) {
      const booking = JSON.parse(pending);
      setClientSecret(booking.clientSecret);
    }
  }, []);

  if (!clientSecret) {
    return <div>Loading...</div>;
  }

  return (
    <div className="checkout-container">
      <div className="checkout-card">
        <Link to="/home" className="back-link">← Back to Home</Link>
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <CheckoutForm />
        </Elements>
      </div>
    </div>
  );
};

export default Checkout;

