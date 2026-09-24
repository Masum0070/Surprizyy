function ContactFooter({
  whatsappNumber = "",
  instagramUrl = "",
}) {
  return (
    <footer className="contact-footer">
      <p>Need help? Contact Surprizyy.</p>

      <div className="contact-footer-links">
        {whatsappNumber && (
          <a
            href={`https://wa.me/${whatsappNumber.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp
          </a>
        )}

        {instagramUrl && (
          <a
            href={instagramUrl}
            target="_blank"
            rel="noreferrer"
          >
            Instagram
          </a>
        )}
      </div>

      <p className="footer-credit">
        Made with ♥ on Surprizyy
      </p>
    </footer>
  );
}

export default ContactFooter;