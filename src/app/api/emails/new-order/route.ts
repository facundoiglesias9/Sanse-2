
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // SMTP Credentials from .env
    const smtpEmail = process.env.SMTP_EMAIL;
    const smtpPassword = process.env.SMTP_PASSWORD;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!smtpEmail || !smtpPassword) {
      return NextResponse.json({ error: "Missing SMTP configuration" }, { status: 500 });
    }

    const { items, total, clientName } = await request.json();

    // Obtener detalles del revendedor si no se proporcionan (aunque el cliente envía clientName)
    let resellerName = clientName;
    if (!resellerName) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('nombre, apellido, email')
        .eq('id', user.id)
        .single();
      resellerName = profile ? `${profile.nombre || ''} ${profile.apellido || ''}`.trim() || profile.email : user.email;
    }

    const itemsHtml = items.map((item: any) => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px;">${item.nombre}</td>
        <td style="padding: 10px;">${item.genero || '-'}</td>
        <td style="padding: 10px; text-align: center;">${item.cantidad}</td>
        <td style="padding: 10px; text-align: right;">$${item.precioUnitario?.toLocaleString('es-AR')}</td>
        <td style="padding: 10px; text-align: right;">$${(item.cantidad * item.precioUnitario)?.toLocaleString('es-AR')}</td>
      </tr>
    `).join('');

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #333; text-align: center;">Nuevo Pedido de Revendedor</h2>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
          <p style="margin: 5px 0;"><strong>Revendedor:</strong> ${resellerName}</p>
          <p style="margin: 5px 0;"><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR')}</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background-color: #f0f0f0;">
              <th style="padding: 10px; text-align: left;">Producto</th>
              <th style="padding: 10px; text-align: left;">Género</th>
              <th style="padding: 10px; text-align: center;">Cant.</th>
              <th style="padding: 10px; text-align: right;">Unitario</th>
              <th style="padding: 10px; text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr style="background-color: #333; color: white;">
              <td colspan="4" style="padding: 10px; text-align: right; font-weight: bold;">TOTAL:</td>
              <td style="padding: 10px; text-align: right; font-weight: bold;">$${total.toLocaleString('es-AR')}</td>
            </tr>
          </tfoot>
        </table>

        <div style="text-align: center; margin-top: 30px;">
          <a href="https://sanseperfumes.vercel.app/caja/ventas-revendedores" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver Ventas</a>
        </div>
      </div>
    `;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: smtpEmail,
        pass: smtpPassword,
      },
    });

    await transporter.sendMail({
      from: `"Sanse Perfumes Pedidos" <${smtpEmail}>`,
      to: "sanseperfumes@gmail.com", // Email del administrador
      subject: `📦 Nuevo Pedido de ${resellerName} - $${total.toLocaleString('es-AR')}`,
      html: emailHtml,
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Error sending order email:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
};
