import Foundation
import ImageIO
import Vision

struct OcrResult: Codable {
    let path: String
    let text: String
}

enum OcrError: Error {
    case invalidImage(String)
}

func loadCgImage(from url: URL) throws -> CGImage {
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        throw OcrError.invalidImage(url.path)
    }

    return image
}

func recognizeText(from url: URL) throws -> String {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = ["ko-KR", "en-US"]

    if #available(macOS 13.0, *) {
        request.automaticallyDetectsLanguage = true
    }

    let cgImage = try loadCgImage(from: url)
    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    try handler.perform([request])

    let observations = request.results ?? []
    return observations
        .compactMap { $0.topCandidates(1).first?.string }
        .joined(separator: "\n")
}

let imagePaths = Array(CommandLine.arguments.dropFirst())
let results = imagePaths.map { rawPath -> OcrResult in
    let url = URL(fileURLWithPath: rawPath)
    let text = (try? recognizeText(from: url)) ?? ""
    return OcrResult(path: rawPath, text: text)
}

let encoder = JSONEncoder()
encoder.outputFormatting = [.withoutEscapingSlashes]

let data = try encoder.encode(results)
FileHandle.standardOutput.write(data)
