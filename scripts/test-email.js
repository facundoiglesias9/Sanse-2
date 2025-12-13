
const { Resend } = require('resend');

const resend = new Resend('re_aPTbaVkD_EHMdTCTVzr8urnSQUxRHbEbp');

(async function () {
    try {
        const data = await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: 'sanseperfumes@gmail.com',
            subject: 'Test Script Email',
            html: '<p>Si ves esto, la clave funciona y el problema era el cache del servidor.</p>'
        });
        console.log(data);
    } catch (error) {
        console.error(error);
    }
})();
