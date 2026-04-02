import { describe, it, expect, vi, beforeEach } from 'vitest'
import { compressImage } from './imageCompression'

// ---------------------------------------------------------------------------
// Module mock
// ---------------------------------------------------------------------------
// vi.mock is hoisted by Vitest so it runs before any imports are evaluated.
// We mock the default export of 'browser-image-compression' and expose it via
// vi.hoisted so individual tests can reconfigure the resolved value or
// rejection without re-importing.
// ---------------------------------------------------------------------------

const { mockImageCompression } = vi.hoisted(() => ({
  mockImageCompression: vi.fn(),
}))

vi.mock('browser-image-compression', () => ({
  default: mockImageCompression,
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal File object with a controlled size.
 * The File constructor is available in jsdom; we pad the content array so the
 * reported `file.size` matches what the production code checks.
 */
function makeFile(sizeInBytes: number, name = 'photo.jpg', type = 'image/jpeg'): File {
  // Uint8Array length === byte count, so this produces an exact size.
  const content = new Uint8Array(sizeInBytes)
  return new File([content], name, { type })
}

const BOUNDARY = 500 * 1024 // 512 000 bytes

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('compressImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // Case 1 – File at or below the 500 KB threshold → returned as-is
  // -------------------------------------------------------------------------

  describe('when file size is at or below 500 KB', () => {
    it('returns the original file without calling imageCompression (exactly 500 KB)', async () => {
      // Arrange
      const file = makeFile(BOUNDARY) // exactly 500 * 1024 bytes

      // Act
      const result = await compressImage(file)

      // Assert
      expect(result).toBe(file)
      expect(mockImageCompression).not.toHaveBeenCalled()
    })

    it('returns the original file without calling imageCompression (below 500 KB)', async () => {
      // Arrange
      const file = makeFile(BOUNDARY - 1) // one byte under threshold

      // Act
      const result = await compressImage(file)

      // Assert
      expect(result).toBe(file)
      expect(mockImageCompression).not.toHaveBeenCalled()
    })

    it('returns the original file for an empty file (0 bytes)', async () => {
      // Arrange
      const file = makeFile(0)

      // Act
      const result = await compressImage(file)

      // Assert
      expect(result).toBe(file)
      expect(mockImageCompression).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Case 2 – File > 500 KB → imageCompression called with correct options
  // -------------------------------------------------------------------------

  describe('when file size exceeds 500 KB', () => {
    it('calls imageCompression with the expected options', async () => {
      // Arrange
      const largeFile = makeFile(BOUNDARY + 1) // one byte over threshold
      const compressedFile = makeFile(200 * 1024, 'compressed.jpg')
      mockImageCompression.mockResolvedValue(compressedFile)

      // Act
      await compressImage(largeFile)

      // Assert – verify the call happened with exactly the right config
      expect(mockImageCompression).toHaveBeenCalledOnce()
      expect(mockImageCompression).toHaveBeenCalledWith(largeFile, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: 'image/jpeg',
        initialQuality: 0.8,
      })
    })

    it('calls imageCompression for a file significantly larger than the threshold', async () => {
      // Arrange – 5 MB file
      const largeFile = makeFile(5 * 1024 * 1024)
      const compressedFile = makeFile(400 * 1024, 'compressed.jpg')
      mockImageCompression.mockResolvedValue(compressedFile)

      // Act
      await compressImage(largeFile)

      // Assert
      expect(mockImageCompression).toHaveBeenCalledOnce()
    })
  })

  // -------------------------------------------------------------------------
  // Case 3 – imageCompression throws → original file returned (silent fallback)
  // -------------------------------------------------------------------------

  describe('when imageCompression throws', () => {
    it('returns the original file on a generic error', async () => {
      // Arrange
      const largeFile = makeFile(BOUNDARY + 1)
      mockImageCompression.mockRejectedValue(new Error('Canvas error'))

      // Act
      const result = await compressImage(largeFile)

      // Assert – must NOT re-throw; the original file is the fallback
      expect(result).toBe(largeFile)
    })

    it('returns the original file when imageCompression rejects with a non-Error value', async () => {
      // Arrange – some libraries reject with a plain string
      const largeFile = makeFile(BOUNDARY + 1)
      mockImageCompression.mockRejectedValue('OUT_OF_MEMORY')

      // Act
      const result = await compressImage(largeFile)

      // Assert
      expect(result).toBe(largeFile)
    })

    it('does not propagate the exception to the caller', async () => {
      // Arrange
      const largeFile = makeFile(BOUNDARY + 1)
      mockImageCompression.mockRejectedValue(new Error('WebWorker unavailable'))

      // Act & Assert – must resolve, not reject
      await expect(compressImage(largeFile)).resolves.toBeDefined()
    })
  })

  // -------------------------------------------------------------------------
  // Case 4 – Successful compression → compressed file is returned
  // -------------------------------------------------------------------------

  describe('when compression succeeds', () => {
    it('returns the compressed file produced by imageCompression', async () => {
      // Arrange
      const originalFile = makeFile(BOUNDARY + 1)
      const compressedFile = makeFile(300 * 1024, 'photo-compressed.jpg')
      mockImageCompression.mockResolvedValue(compressedFile)

      // Act
      const result = await compressImage(originalFile)

      // Assert – must be the value resolved by the mock, not the input
      expect(result).toBe(compressedFile)
      expect(result).not.toBe(originalFile)
    })

    it('returns whatever object imageCompression resolves with (duck-type contract)', async () => {
      // Arrange – simulate a File subclass returned by the library
      const originalFile = makeFile(2 * 1024 * 1024)
      const libraryOutput = makeFile(490 * 1024, 'output.jpg')
      mockImageCompression.mockResolvedValue(libraryOutput)

      // Act
      const result = await compressImage(originalFile)

      // Assert
      expect(result).toBe(libraryOutput)
      expect(mockImageCompression).toHaveBeenCalledOnce()
    })
  })
})
