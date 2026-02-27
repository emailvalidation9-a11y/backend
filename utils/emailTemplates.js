/**
 * Professional HTML email templates for TrueValidator.
 * Uses table-based layout and inline styles for maximum email client compatibility.
 */

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const BRAND = { name: 'TrueValidator', primary: '#4f46e5', primaryDark: '#4338ca', text: '#374151', muted: '#6b7280', border: '#e5e7eb' };

/**
 * Wraps content in a consistent layout: header, body, footer.
 */
function wrapBody(content) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${BRAND.name}</title>
</head>
<body style="margin:0; padding:0; background-color:#f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px; width:100%; background-color:#ffffff; border-radius:12px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px 24px; border-bottom: 1px solid ${BRAND.border};">
              <p style="margin:0; font-size: 20px; font-weight: 700; color: ${BRAND.primary}; letter-spacing: -0.02em;">${BRAND.name}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px 32px; border-top: 1px solid ${BRAND.border}; background-color:#f9fafb;">
              <p style="margin:0; font-size: 12px; color: ${BRAND.muted}; text-align: center;">
                This email was sent by ${BRAND.name}. If you didn't request it, you can safely ignore it.
              </p>
              <p style="margin: 8px 0 0; font-size: 12px; color: ${BRAND.muted}; text-align: center;">
                <a href="${FRONTEND_URL}" style="color: ${BRAND.primary}; text-decoration: none;">Visit ${BRAND.name}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Primary CTA button (single, centered).
 */
function button(href, label) {
  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
  <tr>
    <td align="center" style="padding: 8px 0 24px;">
      <a href="${href}" style="display: inline-block; background-color: ${BRAND.primary}; color: #ffffff !important; padding: 14px 28px; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">${label}</a>
    </td>
  </tr>
</table>`;
}

/**
 * Paragraph block.
 */
function p(text, style = '') {
  return `<p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: ${BRAND.text}; ${style}">${text}</p>`;
}

/**
 * Heading (e.g. H1).
 */
function h1(text) {
  return `<h1 style="margin: 0 0 24px; font-size: 22px; font-weight: 700; color: #111827; line-height: 1.3;">${text}</h1>`;
}

/**
 * Muted link line (e.g. "Or copy this link").
 */
function linkFallback(label, url) {
  return `<p style="margin: 0 0 8px; font-size: 13px; color: ${BRAND.muted};">${label}</p><p style="margin: 0 0 24px; font-size: 13px; word-break: break-all;"><a href="${url}" style="color: ${BRAND.primary}; text-decoration: none;">${url}</a></p>`;
}

// ─── Template builders ─────────────────────────────────────────────────────

function verifyEmail({ name, verifyURL, isWelcome = true, expiryHours = 24 }) {
  const title = isWelcome ? 'Welcome to TrueValidator' : 'Verify your email';
  const intro = isWelcome
    ? `Hi ${name}, thanks for signing up. Please verify your email address by clicking the button below.`
    : `Hi ${name}, please verify your email address by clicking the button below.`;
  const expiryText = expiryHours === 1 ? '1 hour' : `${expiryHours} hours`;
  const content = h1(title) + p(intro) + p(`This link expires in ${expiryText} and can only be used once.`, 'font-size: 14px; color: ' + BRAND.muted + ';') + button(verifyURL, 'Verify my email') + linkFallback('Or copy and paste this link into your browser:', verifyURL) + p('If you didn\'t create an account, you can safely ignore this email.', 'font-size: 14px; color: ' + BRAND.muted + ';');
  return wrapBody(content);
}

function passwordResetRequest({ resetURL, expiryMinutes = 10 }) {
  const expiryText = expiryMinutes === 1 ? '1 minute' : `${expiryMinutes} minutes`;
  const content = h1('Reset your password') + p(`You requested a password reset. Click the button below to choose a new password. This link expires in ${expiryText} and can only be used once.`) + button(resetURL, 'Reset password') + linkFallback('Or copy this link:', resetURL) + p('If you didn\'t request a reset, please ignore this email. Your password will stay the same.', 'font-size: 14px; color: ' + BRAND.muted + ';');
  return wrapBody(content);
}

function passwordResetSuccess() {
  const content = h1('Password reset successful') + p('Your password has been changed successfully. You can now sign in with your new password.');
  return wrapBody(content);
}

function bulkJobCompleted({ name, total, downloadUrl }) {
  const content = h1('Bulk validation complete') + p(`Hi ${name},`) + p(`Your bulk validation job has finished. It processed <strong>${total}</strong> emails.`) + (downloadUrl ? button(downloadUrl, 'Download results') + linkFallback('Or copy this link to download:', downloadUrl) : p(`<a href="${FRONTEND_URL}/history" style="color: ${BRAND.primary}; text-decoration: none;">View job in your dashboard</a>.`));
  return wrapBody(content);
}

function lowCredits({ name, credits, creditsLimit, billingUrl }) {
  const billingLink = billingUrl || `${FRONTEND_URL}/billing`;
  const content = h1('Low credit alert') + p(`Hi ${name},`) + p('Your validation credits are running low.') + `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; text-align: center;"><p style="margin: 0; font-size: 28px; font-weight: 700; color: #b45309;">${credits}</p><p style="margin: 4px 0 0; font-size: 14px; color: #92400e;">credits remaining of ${creditsLimit}</p></td></tr></table>` + p('') + button(billingLink, 'Buy more credits');
  return wrapBody(content);
}

function accountDeleted({ name }) {
  const content = h1('Account deleted') + p(`Hi ${name},`) + p('Your TrueValidator account and all associated data have been permanently deleted as requested.') + p('If you didn\'t request this, please contact our support team immediately.', 'font-size: 14px; color: ' + BRAND.muted + ';');
  return wrapBody(content);
}

function subscriptionConfirmed({ planName, creditsLimit }) {
  const content = h1('Subscription confirmed') + p(`Thank you for subscribing to the <strong>${planName}</strong> plan.`) + p(`Your account has been credited with <strong>${creditsLimit}</strong> validation credits. You can start using them right away.`) + button(FRONTEND_URL + '/dashboard', 'Go to dashboard');
  return wrapBody(content);
}

function creditPurchaseConfirmed({ packName, addedCredits }) {
  const content = h1('Purchase confirmed') + p(`Thank you for purchasing the <strong>${packName}</strong> package.`) + p(`<strong>${addedCredits}</strong> credits have been added to your account.`) + button(FRONTEND_URL + '/dashboard', 'Go to dashboard');
  return wrapBody(content);
}

module.exports = {
  verifyEmail,
  passwordResetRequest,
  passwordResetSuccess,
  bulkJobCompleted,
  lowCredits,
  accountDeleted,
  subscriptionConfirmed,
  creditPurchaseConfirmed,
};
