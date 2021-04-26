export const getMousePosition = (event, container) => {
  container = container || event.target

  if (!(container instanceof Element)) {
    throw new Error(`The 'container' does not have the 'Element' interface.`)
  }

  const rect = container.getBoundingClientRect()

  const x = Math.round((event.clientX - rect.left)) / rect.width
  const y = Math.round((event.clientY - rect.top)) / rect.height

  return { x, y }
}
