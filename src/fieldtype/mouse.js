export const getMousePosition = (event, container) => {
  container = container || event.target
  if (!(container instanceof Node)) {
    throw new Error('The parent node or scope node parameter must be of type HTMLNode.')
  }

  if (![Node.ELEMENT_NODE, Node.TEXT_NODE].some(type => type === container.nodeType)) {
    throw new Error('The node to relate to is not an element or text node.')
  }

  const rect = container.getBoundingClientRect()

  const x = Math.round((event.clientX - rect.left)) / rect.width
  const y = Math.round((event.clientY - rect.top)) / rect.height

  return { x, y }
}
