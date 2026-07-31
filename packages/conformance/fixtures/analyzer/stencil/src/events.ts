/** Payload carried by the button's press event. */
export interface PressEvent {
  /** Which pointer kind triggered the press. */
  pointerType: 'mouse' | 'touch' | 'pen';
}
