// FAQ accordion: each question toggles its answer open and closed.
for (const question of document.querySelectorAll(".FAQ__title")) {
  question.addEventListener("click", () => {
    const answer = question.nextElementSibling;
    const open = question.getAttribute("aria-expanded") === "true";
    question.setAttribute("aria-expanded", String(!open));
    answer.style.maxHeight = open ? null : answer.scrollHeight + "px";
  });
}
