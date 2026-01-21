import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { getLowStockMeta } from "@/app/helpers/stock-logic";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const smtpEmail = process.env.SMTP_EMAIL;
        const smtpPassword = process.env.SMTP_PASSWORD;

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({ error: "Missing Supabase configuration" }, { status: 500 });
        }

        if (!smtpEmail || !smtpPassword) {
            return NextResponse.json({ error: "Missing SMTP configuration" }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Obtener todo el inventario
        const { data: inventario, error } = await supabase
            .from("inventario")
            .select("*");

        if (error) {
            console.error("Error fetching inventory:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!inventario || inventario.length === 0) {
            return NextResponse.json({ message: "No inventory found" });
        }

        // Filtrar por stock bajo
        const lowStockItems = inventario.filter((item) => {
            // Asegurar que la cantidad se maneje como número (por defecto 0 si es null/undefined)
            const quantity = typeof item.cantidad === 'number' ? item.cantidad : 0;
            const mappedItem = {
                ...item,
                cantidad: quantity,
                tipo: item.tipo || "",
                nombre: item.nombre || ""
            };
            const meta = getLowStockMeta(mappedItem);
            return meta.low;
        });

        if (lowStockItems.length === 0) {
            return NextResponse.json({ message: "No low stock items found" });
        }

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: smtpEmail,
                pass: smtpPassword,
            },
        });

        // Crear lista HTML
        const itemsRows = lowStockItems
            .map(
                (item, index) =>
                    `<tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f8f9fa'};">
             <td style="padding: 12px 15px; border-bottom: 1px solid #eeeeee; color: #333; font-weight: 500;">${item.nombre}</td>
             <td style="padding: 12px 15px; border-bottom: 1px solid #eeeeee; color: #666; font-size: 0.9em;">
                <span style="background-color: #e3f2fd; color: #1565c0; padding: 4px 8px; border-radius: 4px; font-size: 0.85em; font-weight: 600;">${item.tipo}</span>
             </td>
             <td style="padding: 12px 15px; border-bottom: 1px solid #eeeeee; color: #d32f2f; font-weight: bold; text-align: right;">${item.cantidad}</td>
           </tr>`
            )
            .join("");

        // Enviar Email
        const info = await transporter.sendMail({
            from: `"Sanse Perfumes" <${smtpEmail}>`,
            to: "sanseperfumes@gmail.com",
            subject: `📉 Reporte de Stock Bajo - ${new Date().toLocaleDateString('es-AR')}`,
            html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
            <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                
                <!-- Encabezado -->
                <div style="background-color: #09090b; padding: 30px 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px;">Sanse Perfumes</h1>
                    <p style="color: #a1a1aa; margin: 5px 0 0; font-size: 14px;">Reporte Automático de Inventario</p>
                </div>

                <!-- Cuerpo -->
                <div style="padding: 30px;">
                    <div style="text-align: center; margin-bottom: 25px;">
                        <h2 style="color: #d32f2f; margin: 0 0 10px; font-size: 20px;">⚠️ Atención: Stock Crítico</h2>
                        <p style="color: #555; margin: 0; font-size: 15px; line-height: 1.5;">
                            Hemos detectado <strong>${lowStockItems.length} items</strong> que han alcanzado sus niveles mínimos de stock y requieren reposición.
                        </p>
                    </div>

                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <tbody>
                            ${itemsRows}
                        </tbody>
                    </table>

                    <div style="margin-top: 30px; text-align: center;">
                        <a href="https://sanseperfumes.vercel.app/abm/inventario" style="display: inline-block; background-color: #000000; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px;">Ir al Inventario</a>
                    </div>
                </div>

                <!-- Pie de página -->
                <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eeeeee;">
                    <p style="margin: 0; color: #888; font-size: 12px;">
                        Este reporte se genera diariamente a las 11:00 AM.
                    </p>
                </div>

            </div>
        </body>
        </html>
      `,
        });

        return NextResponse.json({
            success: true,
            message: `Email sent to sanseperfumes@gmail.com with ${lowStockItems.length} items.`,
            messageId: info.messageId
        });

    } catch (error: any) {
        console.error("Cron job error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
