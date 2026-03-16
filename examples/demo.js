import "core-js/stable";
import "regenerator-runtime/runtime";
import "intersection-observer";

const node = window.appState?.panel?.active;
const label = node ?? "none";
if ($(".legacy")) {
  console.log(label);
}

document.write("<p>Legacy render path</p>");
