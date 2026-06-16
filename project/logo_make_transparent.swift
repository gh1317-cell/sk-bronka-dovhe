import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let inputPath = "project/images/logo-before-transparent.png"
let outputPath = "project/images/logo.png"

func rgbaIndex(_ x: Int, _ y: Int, _ width: Int) -> Int {
  (y * width + x) * 4
}

let inputURL = URL(fileURLWithPath: inputPath)
guard
  let source = CGImageSourceCreateWithURL(inputURL as CFURL, nil),
  let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
else {
  fputs("Unable to load image\n", stderr)
  exit(1)
}

let width = image.width
let height = image.height
let bytesPerRow = width * 4

guard
  let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
  let context = CGContext(
    data: nil,
    width: width,
    height: height,
    bitsPerComponent: 8,
    bytesPerRow: bytesPerRow,
    space: colorSpace,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
  )
else {
  fputs("Unable to create bitmap context\n", stderr)
  exit(1)
}

context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))

guard let raw = context.data else {
  fputs("Unable to access pixel buffer\n", stderr)
  exit(1)
}

let pixels = raw.bindMemory(to: UInt8.self, capacity: width * height * 4)

func isNearWhiteBackground(_ x: Int, _ y: Int) -> Bool {
  let i = rgbaIndex(x, y, width)
  let r = Int(pixels[i])
  let g = Int(pixels[i + 1])
  let b = Int(pixels[i + 2])
  let a = Int(pixels[i + 3])
  let maxDiff = max(abs(r - g), abs(r - b), abs(g - b))
  return a > 240 && r > 232 && g > 232 && b > 232 && maxDiff < 18
}

var background = Array(repeating: false, count: width * height)
var queue: [(Int, Int)] = []
queue.reserveCapacity(width * 4 + height * 4)

func enqueue(_ x: Int, _ y: Int) {
  let idx = y * width + x
  if background[idx] { return }
  if isNearWhiteBackground(x, y) {
    background[idx] = true
    queue.append((x, y))
  }
}

for x in 0..<width {
  enqueue(x, 0)
  enqueue(x, height - 1)
}

for y in 0..<height {
  enqueue(0, y)
  enqueue(width - 1, y)
}

let neighbors = [(-1, 0), (1, 0), (0, -1), (0, 1)]
var head = 0

while head < queue.count {
  let (x, y) = queue[head]
  head += 1

  for (dx, dy) in neighbors {
    let nx = x + dx
    let ny = y + dy
    if nx >= 0 && nx < width && ny >= 0 && ny < height {
      enqueue(nx, ny)
    }
  }
}

var minX = width
var minY = height
var maxX = 0
var maxY = 0

for y in 0..<height {
  for x in 0..<width {
    let bg = background[y * width + x]
    let i = rgbaIndex(x, y, width)

    if bg {
      let r = Int(pixels[i])
      let g = Int(pixels[i + 1])
      let b = Int(pixels[i + 2])
      let brightness = max(r, max(g, b))
      let softness = max(0, min(255, (255 - brightness) * 6))
      pixels[i + 3] = UInt8(softness)
    } else {
      minX = min(minX, x)
      minY = min(minY, y)
      maxX = max(maxX, x)
      maxY = max(maxY, y)
      pixels[i + 3] = 255
    }
  }
}

if minX >= maxX || minY >= maxY {
  fputs("Failed to isolate non-background content\n", stderr)
  exit(1)
}

let cropPadding = 6
let cropX = max(minX - cropPadding, 0)
let cropY = max(minY - cropPadding, 0)
let cropWidth = min((maxX - minX + 1) + cropPadding * 2, width - cropX)
let cropHeight = min((maxY - minY + 1) + cropPadding * 2, height - cropY)

guard
  let processed = context.makeImage(),
  let cropped = processed.cropping(to: CGRect(x: cropX, y: cropY, width: cropWidth, height: cropHeight))
else {
  fputs("Failed to create output image\n", stderr)
  exit(1)
}

let outputURL = URL(fileURLWithPath: outputPath)
guard let destination = CGImageDestinationCreateWithURL(outputURL as CFURL, UTType.png.identifier as CFString, 1, nil) else {
  fputs("Failed to create destination\n", stderr)
  exit(1)
}

CGImageDestinationAddImage(destination, cropped, nil)

if !CGImageDestinationFinalize(destination) {
  fputs("Failed to finalize PNG\n", stderr)
  exit(1)
}

print("Transparent logo saved to \(outputPath)")
