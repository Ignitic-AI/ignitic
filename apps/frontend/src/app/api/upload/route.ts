import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Configure cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('file') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    const uploadPromises = files.map(async (file) => {
      // Convert file to base64
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Data = buffer.toString('base64');
      const fileUri = `data:${file.type};base64,${base64Data}`;

      // Upload to cloudinary
      return new Promise<string>((resolve, reject) => {
        cloudinary.uploader.upload(
          fileUri,
          {
            folder: 'chat_attachments',
            resource_type: 'auto',
            // optional: you could add transformations here
          },
          (error: any, result: any) => {
            if (error) {
              reject(error);
            } else if (result) {
              resolve(result.secure_url);
            } else {
              reject(new Error("Cloudinary upload resulted in no error but null result."));
            }
          }
        );
      });
    });

    const secureUrls = await Promise.all(uploadPromises);

    return NextResponse.json({ urls: secureUrls });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to upload images' },
      { status: 500 }
    );
  }
}
