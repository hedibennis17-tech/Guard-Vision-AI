import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file     = formData.get("file") as File;
    const path     = formData.get("path") as string;
    const provider = (formData.get("provider") as string) ?? process.env.CLIP_STORAGE_PROVIDER ?? "cloudflare";

    if (!file || !path) return NextResponse.json({ error:"file et path requis" }, { status:400 });

    const buffer = Buffer.from(await file.arrayBuffer());

    if (provider === "cloudflare") {
      const accountId = process.env.R2_ACCOUNT_ID;
      const accessKey = process.env.R2_ACCESS_KEY_ID;
      const secretKey = process.env.R2_SECRET_ACCESS_KEY;
      const bucket    = process.env.R2_BUCKET ?? "visionguard-clips";
      const publicUrl = process.env.R2_PUBLIC_URL;

      if (!accountId || !accessKey || !secretKey) {
        return NextResponse.json({
          error:"Variables R2 manquantes",
          setup:"Vercel → Settings → Env Vars → ajouter R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL"
        }, { status:500 });
      }

      const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
      const client = new S3Client({
        region:"auto",
        endpoint:`https://${accountId}.r2.cloudflarestorage.com`,
        credentials:{ accessKeyId:accessKey, secretAccessKey:secretKey },
      });
      await client.send(new PutObjectCommand({ Bucket:bucket, Key:path, Body:buffer, ContentType:file.type }));
      const url = `${publicUrl}/${path}`;
      return NextResponse.json({ url, provider:"cloudflare", sizeKb:Math.round(buffer.length/1024) });
    }

    return NextResponse.json({ error:`Provider non supporté: ${provider}` }, { status:400 });
  } catch (err:any) {
    return NextResponse.json({ error:err.message }, { status:500 });
  }
}
