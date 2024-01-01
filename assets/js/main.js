const { createApp, ref } = Vue;

createApp({
  data() {
    return {
      // Audio
      buffer: null,
      peaks: [],
      threshold: 0.7,
      skip: 120,
      // Project
      project: null,
      projectAdjustmentSegments: null,
      selectedAdjustmentSegment: null,
      // Adjustments
      adjustmentTypes: [
        { name: 'Color',      value: false },
        { name: 'Temp',       value: 'KFTypeTemperature' },
        { name: 'Tint',       value: 'KFTypeHue' },
        { name: 'Saturation', value: 'KFTypeSaturation' },
        { name: 'Lightness',  value: false },
        { name: 'Exposure',   value: 'KFTypeBrightness' },
        { name: 'Contrast',   value: 'KFTypeContrast' },
        { name: 'Highlight',  value: 'KFTypeHightLight' },
        { name: 'Shadow',     value: 'KFTypeShadow' },
        { name: 'Whites',     value: 'KFTypeWhite' },
        { name: 'Blacks',     value: 'KFTypeBlack' },
        { name: 'Brilliance', value: 'KFTypeLightSensatione' },
        { name: 'Effects',    value: false },
        { name: 'Sharpen',    value: 'KFTypeSharpen' },
        { name: 'Clarity',    value: 'KFTypeClear' },
        { name: 'Particles',  value: 'KFTypeParticle' },
        { name: 'Fade',       value: 'KFTypeFade' },
        { name: 'Vignette',   value: 'KFTypeVignetting' }
      ],
      adjustments: []
    }
  },
  mounted: function() {
    document.querySelector('.flex').style.opacity = 1;
  },
  methods: {

    // On threshold change

    handleThresholdChange(e) {
      this.threshold = e.target.value;
      this.getPeaks();
    },

    // On skip change

    handleSkipChange(e) {
      this.skip = e.target.value;
      this.getPeaks();
    },

    // On file upload

    handleAudioUpload(e) {
      let btn = e.target.parentNode.querySelector('.btn');
      let file = e.target.files[0];
      if (!file) {
        this.peaks = [];
        btn.innerHTML = 'Select file';
        return;
      }
      let reader = new FileReader();
      let context = new(window.AudioContext || window.webkitAudioContext)();
      reader.onload = () => {
        context.decodeAudioData(reader.result, (buffer) => {
          btn.innerHTML = file.name;
          this.prepareBuffer(buffer);
        });
      };
      reader.readAsArrayBuffer(file);
    },

    prepareBuffer(buffer) {
      let offlineContext = new OfflineAudioContext(1, buffer.length, buffer.sampleRate);
      let source = offlineContext.createBufferSource();
      source.buffer = buffer;
      let filter = offlineContext.createBiquadFilter();
      filter.type = "lowpass";
      source.connect(filter);
      filter.connect(offlineContext.destination);
      source.start(0);
      offlineContext.startRendering();
      offlineContext.oncomplete = (e) => {
        this.buffer = e.renderedBuffer;
        this.getPeaks();
      };
    },

    // Get threshold value relative to the max peak

    getThreshold(data, threshold) {
      let max = arrayMax(data);
      let min = arrayMin(data);
      return min + (max - min) * threshold;
    },

    // Get peak positions in microseconds

    getPeaks() {
      if (!this.buffer) return;
      let data = this.buffer.getChannelData(0);
      let length = data.length;
      let sampleRate = this.buffer.sampleRate;
      let skip = parseInt(this.skip * sampleRate / 1000);
      let threshold = this.getThreshold(data, this.threshold);
      let peaks = this.getPeaksAtThreshold(data, threshold, skip);
      this.peaks = peaks.map(peak => parseInt(peak * 1000000 / sampleRate));
    },

    // http://tech.beatport.com/2014/web-audio/beat-detection-using-web-audio/

    getPeaksAtThreshold(data, threshold, skip) {
      let peaksArray = [];
      let length = data.length;
      for (let i = 0; i < length;) {
        if (data[i] > threshold) {
          peaksArray.push(i);
          i += skip;
        }
        i++;
      }
      return peaksArray;
    },

    // Project

    handleProjectUpload(e) {
      let btn = e.target.parentNode.querySelector('.btn');
      let file = e.target.files[0];
      if (!file) {
        btn.innerHTML = 'Select file';
        this.project = null;
        return;
      }
      let reader = new FileReader();
      reader.onload = () => {
        let project = JSON.parse(reader.result);
        btn.innerHTML = file.name;
        console.log(project);
        this.project = project;
        this.getAdjustmentSegments();
      };
      reader.readAsText(file);
    },

    // Segments

    getAdjustmentSegments() {
      // Get project adjustment segments
      let tracks = this.project.tracks.filter(t => t.type === 'adjust');
      let segments = tracks.map(t => t.segments).flat();
      segments.map(s => {
        s.name = this.project.materials.placeholders.find(p => {
          return p.id == s.material_id
        }).name;
      });
      this.projectAdjustmentSegments = segments;
      // Select first segment
      if (segments.length) {
        this.selectedAdjustmentSegment = segments[0].id;
      }
    },

    selectAdjustmentSegment(e) {
      this.selectedAdjustmentSegment = e.target.value;
    },

    // Keyframes

    createKeyframes() {
      for (let adjustment of this.adjustments) {
        let keyframeGroup = this.createKeyframeGroup(adjustment);
        for (let track of this.project.tracks) {
          if (track.type !== 'adjust') continue;
          for (let segment of track.segments) {
            if (segment.id === this.selectedAdjustmentSegment) {
              segment.common_keyframes.push(keyframeGroup);
            }
          }
        }
      }
      console.log(this.project.tracks);
    },

    createKeyframeGroup(adjustment) {
      let env = this.createEnvelope(adjustment);
      let kfs = Object.entries(env).map(([k, v]) => this.createKeyframe(k, v));
      return {
        id: generateID(),
        keyframe_list: kfs,
        material_id: "",
        property_type: adjustment.type
      }
    },

    createKeyframe(time, value) {
      return {
        curveType:"Line",
        graphID: "",
        id: generateID(),
        left_control: {x: 0, y: 0},
        right_control: {x: 0, y: 0},
        time_offset: parseInt(time),
        values: [value]
      }
    },

    // Convert peaks to keyframes

    createEnvelope(adjustment) {
      let on      = adjustment.peakValue;
      let off     = adjustment.baseValue;
      let attack  = adjustment.attack * 1000;
      let release = adjustment.release * 1000;
      let data    = {};

      for (let i in this.peaks) {
        let time = this.peaks[i]; // this peak
        let next = this.peaks[i + 1] || null; // next peak
        if (data[time]) continue; // skip if already exists
        data[time] = off; // keyframe: start
        data[time + attack] = on; // keyframe: attack
        // if the next peak is closer than release
        if (next && next - time < attack + release) {
          // keyframe: partial release on start of next peak
          data[next] = (next - time) / (attack + release) * (on - off);
        } else {
          data[time + attack + release] = off; // keyframe: release
        }
      }

      return data;
    },

    // Adjustments

    addAdjustment() {
      this.adjustments.push({
        attack: 10,
        release: 200,
        type: 'KFTypeContrast',
        baseValue: 0,
        peakValue: 0.5,
        id: generateID(),
      });
    },

    removeAdjustment(id) {
      this.adjustments.splice(this.adjustments.findIndex(a => a.id === id), 1);
    },

    // Export

    projectExport() {
      console.log(this.project);
      let project = JSON.stringify(this.project);
      let blob = new Blob([project], { type: "application/json" });
      let url = URL.createObjectURL(blob);
      let a = document.createElement("a");
      a.href = url;
      a.download = "draft_content.json";
      a.click();
    },

    // Buttons

    buttonDisabled(button) {
      switch (button) {
        case 'create_keyframes':
          return (
            this.peaks.length === 0 ||
            this.project === null ||
            this.adjustments.length === 0 ||
            this.selectedAdjustmentSegment === null
          );
        default:
          return false;
      }
    }

  }
}).mount('#app');
