export const getNumberComment = (comment: string): string => {
  const phoneRegex = /(\+?\d[\d\s\-().]{7,}\d)/g;
  const matches = comment.match(phoneRegex);
  let textToCopy = comment;
  if (matches && matches.length) {
    let phoneNumber = matches[0].trim().replace(/^\+?7/, '8');
    if (!phoneNumber.startsWith('8')) {
      phoneNumber = '8' + phoneNumber;
    }
    phoneNumber = phoneNumber.replace(/\D/g, '');
    textToCopy = phoneNumber;
  }
  return textToCopy;
};