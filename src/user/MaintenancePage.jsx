import "../styles/user.css";

export default function MaintenancePage({ siteName = "Surprizyy" }) {
  return (
    <main className="maintenance-page">
      <section className="maintenance-card">
        <div className="maintenance-icon">🛠️</div>
        <span>PLEASE CHECK BACK SOON</span>
        <h1>{siteName} is under maintenance</h1>
        <p>
          We are improving the experience right now. Your surprises and
          customer data are safe. Please try again in a little while.
        </p>
      </section>
    </main>
  );
}
