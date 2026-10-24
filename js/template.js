// Quote template page: the print button prints only the blank template
// (see css/template-print.css).

document.getElementById("print-template")?.addEventListener("click", () => window.print());
