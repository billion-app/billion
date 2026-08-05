const BILLION_LOGO_URL = "https://www.billion-news.app/billion-logo.png";
const BILLION_SITE_URL = "https://www.billion-news.app";

export const WAITLIST_CONFIRMATION_SUBJECT = "You're on the Billion waitlist";

export const WAITLIST_CONFIRMATION_TEXT = [
  "You're on the Billion waitlist.",
  "",
  "Thanks for signing up for Billion—the simpler way to see what your government is actually doing.",
  "",
  "We'll email you when there's an update. You don't need to do anything else.",
  "",
  "Thanks for being early.",
  "— The Billion team",
].join("\n");

export const WAITLIST_CONFIRMATION_HTML = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" lang="en" xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no" />
    <title>${WAITLIST_CONFIRMATION_SUBJECT}</title>
    <style type="text/css">
      body {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        -webkit-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
      }
      table {
        border-collapse: collapse !important;
        border-spacing: 0 !important;
      }
      img {
        border: 0;
        height: auto;
        line-height: 100%;
        outline: none;
        text-decoration: none;
        -ms-interpolation-mode: bicubic;
      }
      a {
        text-decoration: none;
      }
      @media only screen and (max-width: 600px) {
        .email-shell {
          padding: 24px 12px !important;
        }
        .container {
          width: 100% !important;
        }
        .wordmark {
          padding-bottom: 22px !important;
        }
        .content {
          padding-left: 28px !important;
          padding-right: 28px !important;
        }
        .headline {
          font-size: 31px !important;
          line-height: 38px !important;
        }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:#0E1530;color:#FFFFFF;">
    <div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;color:transparent;line-height:1px;font-size:1px;mso-hide:all;">
      You’re on the Billion waitlist. We’ll let you know when there’s an update.&#847; &#847; &#847; &#847; &#847;
    </div>

    <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;background-color:#0E1530;">
      <tr>
        <td class="email-shell" align="center" style="padding:32px 16px;">
          <table class="container" width="600" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:600px;max-width:600px;">
            <tr>
              <td class="wordmark" align="center" style="padding:8px 24px 28px;">
                <table border="0" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td style="padding-right:10px;vertical-align:middle;">
                      <a href="${BILLION_SITE_URL}" target="_blank" rel="noopener noreferrer">
                        <img src="${BILLION_LOGO_URL}" width="30" height="30" alt="Billion" style="display:block;width:30px;height:30px;border-radius:6px;" />
                      </a>
                    </td>
                    <td style="vertical-align:middle;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;font-weight:700;letter-spacing:3px;color:#FFFFFF;">
                      <a href="${BILLION_SITE_URL}" target="_blank" rel="noopener noreferrer" style="color:#FFFFFF;">BILLION</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="background-color:#272D3C;border:1px solid #3A4152;border-radius:16px;overflow:hidden;">
                <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td class="content" style="padding:48px 48px 8px;font-family:Georgia,'Times New Roman',serif;color:#FFFFFF;">
                      <h1 class="headline" style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:43px;font-weight:700;letter-spacing:-0.4px;">
                        You’re on the<br /><em style="font-weight:700;">waitlist.</em>
                      </h1>
                    </td>
                  </tr>

                  <tr>
                    <td class="content" style="padding:22px 48px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;color:#E7E9F0;">
                      <p style="margin:0 0 18px;">Thanks for signing up for Billion—the simpler way to see what your government is actually doing.</p>
                      <p style="margin:0;">We’ll email you when there’s an update. You don’t need to do anything else.</p>
                    </td>
                  </tr>

                  <tr>
                    <td class="content" style="padding:30px 48px 0;">
                      <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                        <tr>
                          <td style="border-top:1px solid #3A4152;font-size:0;line-height:0;">&nbsp;</td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td class="content" style="padding:22px 48px 46px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;color:#E7E9F0;">
                      <p style="margin:0 0 4px;">Thanks for being early.</p>
                      <p style="margin:0;color:#AEB3C1;">— The Billion team</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:26px 32px 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#AEB3C1;">
                <p style="margin:0;">
                  You’re receiving this because you joined the Billion waitlist.<br />
                  <a href="${BILLION_SITE_URL}" target="_blank" rel="noopener noreferrer" style="color:#AEB3C1;text-decoration:underline;">Visit Billion</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
