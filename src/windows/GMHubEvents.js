function prevent(event) {
  event.preventDefault();
  return event.currentTarget;
}

function selectedCondition(element) {
  const custom = element.querySelector("[data-rnk-triggerz-selected-condition-custom]")?.value?.trim();
  return custom || element.querySelector("[data-rnk-triggerz-selected-condition]")?.value;
}

export function bindGMHubEvents({ element, actions } = {}) {
  const textarea = element.querySelector("[data-rnk-triggerz-export]");
  const conditionForm = element.querySelector("[data-rnk-triggerz-condition-form]");
  const triggerForm = element.querySelector("[data-rnk-triggerz-trigger-form]");
  const buttons = [...element.querySelectorAll("[data-action]")];

  conditionForm?.addEventListener("submit", async (event) => {
    await actions.saveConditionFromForm(prevent(event));
  });

  triggerForm?.addEventListener("submit", async (event) => {
    await actions.saveTriggerFromForm(prevent(event));
  });

  for (const button of buttons) {
    button.addEventListener("click", async (event) => {
      const action = event.currentTarget.dataset.action;
      if (action === "export") actions.exportToTextarea(textarea);
      if (action === "import") await actions.importFromTextarea(textarea);
      if (action === "refresh") actions.refresh();
      if (action === "delete-condition") await actions.deleteCondition(event.currentTarget.dataset.id);
      if (action === "delete-trigger") await actions.deleteTrigger(event.currentTarget.dataset.id);
      if (action === "assign-selected") await actions.assignToSelected(selectedCondition(element));
      if (action === "unassign-selected") await actions.unassignFromSelected(selectedCondition(element));
      if (action === "apply-selected") await actions.applyToSelected("apply", selectedCondition(element));
      if (action === "remove-selected") await actions.applyToSelected("remove", selectedCondition(element));
      if (action === "toggle-selected") await actions.applyToSelected("toggle", selectedCondition(element));
    });
  }
  return buttons.length + Number(Boolean(conditionForm)) + Number(Boolean(triggerForm));
}
