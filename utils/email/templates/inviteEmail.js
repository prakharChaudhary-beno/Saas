const inviteTemplate = ({
  name,
  companyName,
  roleName,
  departmentName,
  email,
  tempPassword,
}) => {
  return `
  <!DOCTYPE html>
  <html>
  <body style="margin:0; padding:0; font-family: Arial, sans-serif; background:#f4f6f8;">

  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr>
      <td align="center">

        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff; border-radius:10px; overflow:hidden;">

          <tr>
            <td style="background:#028090; color:#ffffff; padding:20px; text-align:center;">
              <h2 style="margin:0;">
                ${companyName || "HRMS Portal"}
              </h2>
            </td>
          </tr>

          <tr>
            <td style="padding:30px; color:#333333;">

              <h3 style="margin-top:0;">
                Your Account Has Been Created 🎉
              </h3>

              <p>Hi ${name || "User"},</p>

              <p>
                You have been added to
                <b>${companyName || "HRMS"}</b>
                ${roleName ? `as <b>${roleName}</b>` : ""}
                ${departmentName ? ` in <b>${departmentName}</b> department` : ""}.
              </p>

              <p>Please use the following credentials to login:</p>

              <table
                width="100%"
                cellpadding="10"
                cellspacing="0"
                style="background:#f8f9fa; border:1px solid #e5e5e5; border-radius:6px; margin:20px 0;"
              >
                <tr>
                  <td>
                    <strong>Email:</strong><br/>
                    ${email}
                  </td>
                </tr>

                <tr>
                  <td>
                    <strong>Temporary Password:</strong><br/>
                    ${tempPassword}
                  </td>
                </tr>
              </table>

              <p>
                For security reasons, you will be required to change your password after your first login.
              </p>

              <p>
                If you did not expect this account, please contact your administrator.
              </p>

            </td>
          </tr>

          <tr>
            <td style="background:#f1f1f1; padding:15px; text-align:center; font-size:12px; color:#666;">
              © ${new Date().getFullYear()} ${companyName || "HRMS"}
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

  </body>
  </html>
  `;
};

module.exports = inviteTemplate;