export default function WarningScreen({ onContinue }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
    }}>
      <div className="card" style={{ maxWidth: '480px', textAlign: 'center', padding: '40px' }}>
        <h2 style={{ color: '#fff', fontSize: '1.8rem', marginBottom: '16px' }}>Important Notice</h2>
        <p style={{ color: '#a0a0b0', fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '32px' }}>
          All data is stored locally on your device.<br />
          Clearing browser data will erase your study plan.
        </p>
        <button className="btn" onClick={onContinue} style={{ width: '100%', padding: '12px', fontSize: '1.1rem', background: '#7c6fff', color: '#fff', borderColor: '#7c6fff' }}>
          Continue
        </button>
      </div>
    </div>
  );
}
