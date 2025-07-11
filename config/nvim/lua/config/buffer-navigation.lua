-- Smart buffer navigation
local M = {}

-- Function to list buffers with numbers and switch
function M.list_and_switch_buffer()
  local buffers = vim.fn.getbufinfo({ buflisted = 1 })
  
  if #buffers == 0 then
    print("No buffers open")
    return
  end
  
  -- Create a list of buffer names with numbers
  local buffer_list = {}
  for i, buf in ipairs(buffers) do
    local name = vim.fn.fnamemodify(buf.name, ":t")
    if name == "" then
      name = "[No Name]"
    end
    local modified = buf.changed == 1 and " [+]" or ""
    table.insert(buffer_list, string.format("%d: %s%s", i, name, modified))
  end
  
  -- Show the list
  print("Buffers:")
  for _, line in ipairs(buffer_list) do
    print(line)
  end
  
  -- Ask for input
  local choice = vim.fn.input("Enter buffer number: ")
  
  -- Clear the command line
  vim.cmd("echo ''")
  
  -- Switch to the selected buffer
  local num = tonumber(choice)
  if num and num > 0 and num <= #buffers then
    vim.cmd("buffer " .. buffers[num].bufnr)
  elseif choice ~= "" then
    print("Invalid buffer number")
  end
end

-- Function to close all buffers except current
function M.close_other_buffers()
  local current = vim.fn.bufnr("%")
  local buffers = vim.fn.getbufinfo({ buflisted = 1 })
  
  for _, buf in ipairs(buffers) do
    if buf.bufnr ~= current then
      vim.cmd("bdelete " .. buf.bufnr)
    end
  end
end

-- Function to close buffers to the right
function M.close_buffers_to_right()
  local current = vim.fn.bufnr("%")
  local found_current = false
  local buffers = vim.fn.getbufinfo({ buflisted = 1 })
  
  for _, buf in ipairs(buffers) do
    if found_current then
      vim.cmd("bdelete " .. buf.bufnr)
    elseif buf.bufnr == current then
      found_current = true
    end
  end
end

return M