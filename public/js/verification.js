// Keep invitation recovery advice specific to joining a room.
export const verificationError = message => Object.assign(new Error(message), { code: 'verification' });
export function invitationError(error, joining, translate) {
  return error.message + (joining && error.code === 'verification'
    ? ' ' + translate('若重試後仍無法加入，請朋友重新建立邀請並傳送新連結。') : '');
}
