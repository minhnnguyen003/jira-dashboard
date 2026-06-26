export function createHoursByDateInitialState(from, to) {
  return {
    draftRange: { from, to },
    appliedRange: { from, to },
  };
}

export function updateHoursByDateDraftRange(state, nextDraftRange) {
  return {
    ...state,
    draftRange: {
      from: nextDraftRange.from ?? state.draftRange.from,
      to: nextDraftRange.to ?? state.draftRange.to,
    },
  };
}

export function applyHoursByDateDraftRange(state) {
  return {
    ...state,
    appliedRange: {
      from: state.draftRange.from,
      to: state.draftRange.to,
    },
  };
}
