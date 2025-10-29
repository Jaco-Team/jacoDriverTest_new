const React = require('react');
const wrap = (tag = 'div') =>
  React.forwardRef((props, ref) =>
    React.createElement(tag, { ref, ...props }, props?.children)
  );

const Modal = wrap();
const ModalBackdrop = wrap();
const ModalContent = wrap();
const ModalHeader = wrap();
const ModalFooter = wrap();
const ModalBody = wrap();
const ModalCloseButton = wrap('button');

const createModal = () => ({
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
});

module.exports = {
  __esModule: true,
  createModal,
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  default: {
    createModal,
    Modal,
    ModalBackdrop,
    ModalContent,
    ModalHeader,
    ModalFooter,
    ModalBody,
    ModalCloseButton,
  },
};
