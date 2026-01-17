function filterContent() {
  const input = document.getElementById('searchInput');
  if (!input) return;

  const filter = input.value.toUpperCase();
  const cards = document.getElementsByClassName('search-item');

  for (let i = 0; i < cards.length; i++) {
    const h3 = cards[i].getElementsByTagName("h3")[0];
    const p = cards[i].getElementsByTagName("p")[0];
    const text = (h3?.textContent || "") + " " + (p?.textContent || "");
    cards[i].style.display = text.toUpperCase().includes(filter) ? "" : "none";
  }
}
