use super::{CompressError, CompressKind, CompressResult};
use image::RgbaImage;
use mozjpeg::{ColorSpace, Compress};
use std::fs::File;
use std::io::BufWriter;
use std::path::Path;

pub fn compress(input: &Path, output: &Path) -> Result<CompressResult, CompressError> {
    if !input.exists() {
        return Err(CompressError::NotFound(input.display().to_string()));
    }

    let ext = input
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .ok_or_else(|| CompressError::UnsupportedFormat(input.display().to_string()))?;

    let output = output.to_path_buf();

    match ext.as_str() {
        "png" => compress_png(input, &output)?,
        "jpg" | "jpeg" => compress_jpeg(input, &output)?,
        _ => {
            return Err(CompressError::UnsupportedFormat(ext));
        }
    }

    super::finalize_output(input, &output, &CompressKind::Image)
}

pub fn output_for(input: &Path, output_dir: &Path) -> std::path::PathBuf {
    super::output_path_for(input, &super::CompressKind::Image, output_dir)
}

fn compress_png(input: &Path, output: &Path) -> Result<(), CompressError> {
    let img = image::open(input).map_err(|e| CompressError::Image(e.to_string()))?;
    let rgba: RgbaImage = img.to_rgba8();
    let (width, height) = rgba.dimensions();

    let pixels: Vec<imagequant::RGBA> = rgba
        .pixels()
        .map(|p| imagequant::RGBA::new(p[0], p[1], p[2], p[3]))
        .collect();

    let mut liq = imagequant::new();
    liq.set_quality(65, 80)
        .map_err(|e| CompressError::Image(e.to_string()))?;
    liq.set_speed(3)
        .map_err(|e| CompressError::Image(e.to_string()))?;

    let mut in_img = liq
        .new_image(pixels.into_boxed_slice(), width as usize, height as usize, 0.0)
        .map_err(|e| CompressError::Image(e.to_string()))?;
    let mut out_img = liq
        .quantize(&mut in_img)
        .map_err(|e| CompressError::Image(e.to_string()))?;
    let (palette, indices) = out_img
        .remapped(&mut in_img)
        .map_err(|e| CompressError::Image(e.to_string()))?;

    let file = File::create(output)?;
    let writer = BufWriter::new(file);
    let mut encoder = png::Encoder::new(writer, width, height);
    encoder.set_color(png::ColorType::Indexed);
    encoder.set_depth(png::BitDepth::Eight);

    let palette_bytes: Vec<u8> = palette
        .iter()
        .flat_map(|c| [c.r, c.g, c.b])
        .collect();
    encoder.set_palette(&palette_bytes);

    let mut has_alpha = false;
    let mut trns = Vec::with_capacity(palette.len());
    for color in &palette {
        trns.push(color.a);
        if color.a < 255 {
            has_alpha = true;
        }
    }
    if has_alpha {
        encoder.set_trns(&trns);
    }

    {
        let mut png_writer = encoder
            .write_header()
            .map_err(|e| CompressError::Image(e.to_string()))?;
        png_writer
            .write_image_data(&indices)
            .map_err(|e| CompressError::Image(e.to_string()))?;
    }

    let options = oxipng::Options::from_preset(2);
    oxipng::optimize(
        &oxipng::InFile::Path(output.to_path_buf()),
        &oxipng::OutFile::Path {
            path: None,
            preserve_attrs: false,
        },
        &options,
    )
    .map_err(|e| CompressError::Image(e.to_string()))?;

    Ok(())
}

fn compress_jpeg(input: &Path, output: &Path) -> Result<(), CompressError> {
    let img = image::open(input).map_err(|e| CompressError::Image(e.to_string()))?;
    let rgb = img.to_rgb8();
    let (width, height) = rgb.dimensions();

    let mut comp = Compress::new(ColorSpace::JCS_RGB);
    comp.set_size(width as usize, height as usize);
    comp.set_quality(82.0);
    comp.set_progressive_mode();
    comp.set_optimize_scans(true);

    let mut comp = comp
        .start_compress(Vec::new())
        .map_err(|e| CompressError::Image(e.to_string()))?;

    let raw = rgb.as_raw();
    let row_stride = width as usize * 3;
    for row in 0..height as usize {
        let start = row * row_stride;
        let end = start + row_stride;
        comp.write_scanlines(&raw[start..end])
            .map_err(|e| CompressError::Image(e.to_string()))?;
    }

    let jpeg_data = comp
        .finish()
        .map_err(|e| CompressError::Image(e.to_string()))?;
    std::fs::write(output, jpeg_data)?;

    Ok(())
}
