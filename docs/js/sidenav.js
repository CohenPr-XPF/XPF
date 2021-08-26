
// Allow transition for sidebar navigation to be displayed
function openNav() {
  document.getElementById("website-sidenav").style.width = "250px";
  document.getElementById("overlay").style.opacity = "0.5";
  document.getElementById("overlay").style.width = "100%";
  document.getElementById("overlay").style.transition = "all 0.5s";
  document.getElementById("overlay").addEventListener("click", closeNav);
}

// Allow transition for sidebar navigation to be removed
function closeNav() {
  document.getElementById("website-sidenav").style.width = "0";
  document.getElementById("overlay").style.opacity = "1";
  document.getElementById("overlay").style.width = "0";
  document.getElementById("overlay").style.transition = "all 0s";
  document.getElementById("overlay").removeEventListener("click", closeNav);
}

// Sidenav Event Listeners
document.getElementById("display_sidenav").addEventListener("click", openNav); // open
document.getElementById("close_sidenav").addEventListener("click", closeNav); // close
