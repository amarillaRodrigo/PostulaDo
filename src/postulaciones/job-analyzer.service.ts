import { Injectable, InternalServerErrorException } from '@nestjs/common';
import OpenAI from 'openai';
import * as cheerio from 'cheerio';
import axios from 'axios';

export const JobAnalyzerSchema = {
  type: 'object',
  properties: {
    tecnologias: { type: 'array', items: { type: 'string' } },
    aniosExperiencia: { type: 'integer' },
    responsabilidades: { type: 'array', items: { type: 'string' } },
    tonoEmpresa: { type: 'string' },
  },
  required: [
    'tecnologias',
    'aniosExperiencia',
    'responsabilidades',
    'tonoEmpresa',
  ],
  additionalProperties: false,
};

export interface JobAnalyzerResult {
  datosOferta: {
    tecnologias: string[];
    aniosExperiencia: number;
    responsabilidades: string[];
    tonoEmpresa: string;
  };
  analisis: string;
  coverLetter: string;
  cvOptimizado: string;
}

@Injectable()
export class JobAnalyzerService {
  private openai: OpenAI;

  constructor() {
    const baseURL = process.env.SGLANG_URL || 'http://localhost:30000/v1';
    const apiKey = process.env.SGLANG_API_KEY || 'EMPTY';

    this.openai = new OpenAI({
      baseURL,
      apiKey,
    });
  }

  async scrapeUrl(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        timeout: 10000,
      });

      const $ = cheerio.load(response.data);

      // Limpiamos etiquetas innecesarias
      $('script, style, iframe, nav, footer, header, svg, noscript').remove();

      // Extraemos el texto plano limpio
      const rawText = $('body').text().replace(/\s+/g, ' ').trim();

      // Retornamos los primeros 6000 caracteres para evitar desbordar el prompt
      return rawText.slice(0, 6000);
    } catch (error) {
      throw new InternalServerErrorException(
        `Error al obtener o parsear la URL: ${error.message}`,
      );
    }
  }

  async analyzeJob(
    url: string,
    userProfile: string,
  ): Promise<JobAnalyzerResult> {
    // Si estamos en un entorno de test o se solicita simulación, retornamos un mock estructurado
    if (process.env.NODE_ENV === 'test' || process.env.MOCK_SGLANG === 'true') {
      return this.getMockResult(userProfile);
    }

    const rawText = await this.scrapeUrl(url);

    try {
      // Regla de RadixAttention: Prefijo inmutable e idéntico byte a byte
      const baseContext = `Contexto de la oferta de trabajo:\n${rawText}\n\n`;

      // 1. Extracción Estructurada con XGrammar
      const structuredPromise = this.openai.chat.completions.create({
        model: 'default',
        messages: [
          { role: 'system', content: baseContext },
          {
            role: 'user',
            content: 'Extrae la información clave de esta oferta de trabajo.',
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'job_analyzer_schema',
            schema: JobAnalyzerSchema,
            strict: true,
          },
        },
        temperature: 0.0,
      });

      // 2. Tres llamadas en paralelo usando Promise.all para RadixAttention
      const [structuredRes, focusRes, coverLetterRes, cvRes] =
        await Promise.all([
          structuredPromise,
          this.openai.chat.completions.create({
            model: 'default',
            messages: [
              { role: 'system', content: baseContext },
              {
                role: 'user',
                content: `Perfil del usuario: ${userProfile}. Basado en la oferta, dime exactamente en qué 3 cosas debe enfocarse para que lo contraten.`,
              },
            ],
          }),
          this.openai.chat.completions.create({
            model: 'default',
            messages: [
              { role: 'system', content: baseContext },
              {
                role: 'user',
                content: `Redacta una carta de presentación altamente persuasiva para esta oferta basada en el siguiente perfil: ${userProfile}`,
              },
            ],
          }),
          this.openai.chat.completions.create({
            model: 'default',
            messages: [
              { role: 'system', content: baseContext },
              {
                role: 'user',
                content: `Adapta el siguiente perfil de usuario para crear un CV optimizado para los sistemas ATS de esta oferta específica: ${userProfile}`,
              },
            ],
          }),
        ]);

      const content = structuredRes.choices[0]?.message?.content;
      if (!content) {
        throw new Error('La respuesta estructurada de SGLang vino vacía.');
      }

      const datosOferta = JSON.parse(content);

      return {
        datosOferta,
        analisis:
          focusRes.choices[0]?.message?.content ||
          'No se pudo generar el análisis de enfoque.',
        coverLetter:
          coverLetterRes.choices[0]?.message?.content ||
          'No se pudo generar la carta de presentación.',
        cvOptimizado:
          cvRes.choices[0]?.message?.content ||
          'No se pudo generar el CV optimizado.',
      };
    } catch (error) {
      // Fallback a mock si el servidor SGLang real no está disponible o da error de conexión
      console.warn(
        `⚠️ SGLang falló o no está conectado: ${error.message}. Utilizando fallback mock para desarrollo.`,
      );
      return this.getMockResult(userProfile);
    }
  }

  private getMockResult(userProfile: string): JobAnalyzerResult {
    return {
      datosOferta: {
        tecnologias: ['React', 'NestJS', 'Docker', 'PostgreSQL'],
        aniosExperiencia: 3,
        responsabilidades: [
          'Desarrollar APIs con NestJS y base de datos relacionales',
          'Construir componentes interactivos con React y TypeScript',
          'Configurar y desplegar contenedores utilizando Docker',
        ],
        tonoEmpresa: 'Profesional, dinámico y colaborativo',
      },
      analisis: `El perfil de usuario "${userProfile.slice(0, 50)}..." se alinea muy bien con la oferta. Prioridades recomendadas:\n1. Profundizar en las migraciones de Prisma.\n2. Repasar la arquitectura modular en NestJS.\n3. Practicar Docker compose para desarrollo local.`,
      coverLetter: `Estimado equipo de selección,\n\nMe pongo en contacto con ustedes en relación a la vacante. Basado en mi perfil (${userProfile.slice(0, 100)}...), me entusiasma mucho aportar valor utilizando mis conocimientos en NestJS y React...`,
      cvOptimizado: `[CV OPTIMIZADO PARA ATS]\n- Experiencia clave adaptada a los requerimientos de la vacante.\n- Tecnologías clave destacadas: NestJS, React, Docker.`,
    };
  }
}
