import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * Tool to execute shell commands
 */
export class ShellExecutorTool extends StructuredTool {
  name = 'shell_executor';
  description = 'Execute shell commands on the system. Use this for DevOps operations like checking system status, running Docker commands, etc.';
  
  schema = z.object({
    command: z.string().describe('The shell command to execute'),
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    const { command } = input;
    
    try {
      // Import dynamically to avoid issues
      const { exec } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execAsync = promisify(exec);
      
      console.log(`Executing: ${command}`);
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr) {
        return `Command executed with warnings:\nSTDOUT: ${stdout}\nSTDERR: ${stderr}`;
      }
      
      return `Command executed successfully:\n${stdout}`;
    } catch (error) {
      return `Error executing command: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

/**
 * Tool to get system information
 */
export class SystemInfoTool extends StructuredTool {
  name = 'system_info';
  description = 'Get system information like OS, memory, disk usage, etc.';
  
  schema = z.object({
    info_type: z.enum(['os', 'memory', 'disk', 'processes', 'network']).describe('Type of system information to retrieve'),
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    const { info_type } = input;
    
    try {
      const { exec } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execAsync = promisify(exec);
      
      let command: string;
      
      switch (info_type) {
        case 'os':
          command = 'uname -a';
          break;
        case 'memory':
          command = 'free -h';
          break;
        case 'disk':
          command = 'df -h';
          break;
        case 'processes':
          command = 'ps aux | head -20';
          break;
        case 'network':
          command = 'ip addr show';
          break;
        default:
          return 'Invalid info type';
      }
      
      console.log(`Getting ${info_type} information...`);
      const { stdout } = await execAsync(command);
      return `${info_type.toUpperCase()} Information:\n${stdout}`;
    } catch (error) {
      return `Error getting system info: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

/**
 * Tool to check Docker status and containers
 */
export class DockerTool extends StructuredTool {
  name = 'docker_tool';
  description = 'Manage and check Docker containers, images, and system status.';
  
  schema = z.object({
    action: z.enum(['ps', 'images', 'info', 'version', 'stats']).describe('Docker action to perform'),
    container_name: z.string().optional().describe('Container name for specific operations'),
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    const { action, container_name } = input;
    
    try {
      const { exec } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execAsync = promisify(exec);
      
      let command: string;
      
      switch (action) {
        case 'ps':
          command = 'docker ps -a';
          break;
        case 'images':
          command = 'docker images';
          break;
        case 'info':
          command = 'docker info';
          break;
        case 'version':
          command = 'docker version';
          break;
        case 'stats':
          command = container_name ? `docker stats ${container_name} --no-stream` : 'docker stats --no-stream';
          break;
        default:
          return 'Invalid Docker action';
      }
      
      console.log(`Running Docker command: ${command}`);
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr?.includes('Cannot connect to the Docker daemon')) {
        return 'Docker daemon is not running or not accessible';
      }
      
      return `Docker ${action} result:\n${stdout}`;
    } catch (error) {
      return `Error with Docker operation: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

/**
 * Tool to read file contents
 */
export class FileReaderTool extends StructuredTool {
  name = 'file_reader';
  description = 'Read the contents of a file. Useful for examining configuration files, logs, etc.';
  
  schema = z.object({
    file_path: z.string().describe('Path to the file to read'),
    lines: z.number().optional().describe('Number of lines to read (default: all)'),
  });

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    const { file_path, lines } = input;
    
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      
      // Basic security check
      const resolvedPath = path.resolve(file_path);
      if (!resolvedPath.startsWith(process.cwd())) {
        return 'Access denied: File path outside working directory';
      }
      
      console.log(`Reading file: ${file_path}`);
      const content = await fs.readFile(file_path, 'utf-8');
      
      if (lines) {
        const fileLines = content.split('\n');
        return `First ${lines} lines of ${file_path}:\n${fileLines.slice(0, lines).join('\n')}`;
      }
      
      return `Contents of ${file_path}:\n${content}`;
    } catch (error) {
      return `Error reading file: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}
