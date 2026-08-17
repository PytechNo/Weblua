const inquiryEmail = "matthglo8@gmail.com";

export function SaleBanner() {
  return (
    <aside className="sale-banner" aria-label="Domain sale notice">
      <span>This domain is for sale.</span>
      <a href={`mailto:${inquiryEmail}`}>Send inquiries to {inquiryEmail}</a>
    </aside>
  );
}
