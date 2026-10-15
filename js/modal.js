"use strict";
function openForm(title, fields, action) {
  $("#accionTitulo").textContent = title;
  $("#accionCampos").innerHTML = fields;
  $("#dialogError").textContent = "";
  modalAction = action;
  $("#formDialog").showModal();
}
$("#cerrarDialog").onclick = () => $("#formDialog").close();
$("#accionForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = e.submitter;
  button.disabled = true;
  try {
    await modalAction(new FormData(e.target));
    $("#formDialog").close();
  } catch (error) {
    $("#dialogError").textContent = errorText(error);
  } finally {
    button.disabled = false;
  }
});
