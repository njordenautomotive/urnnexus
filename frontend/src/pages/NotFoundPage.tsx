import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="surface surface--padded not-found">
      <div className="section-kicker">404</div>
      <h1 className="section-title">Siden ble ikke funnet</h1>
      <p className="not-found__text">Denne ruten finnes ikke i URN Nexus Web ennå.</p>
      <Link to="/" className="button button--secondary">
        Gå til dashboard
      </Link>
    </section>
  );
}
