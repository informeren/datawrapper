<?php

class DatawrapperPlugin_PublishEmbed extends DatawrapperPlugin {
    public function init() {
        $plugin = $this;

        // hook into chart publication
        DatawrapperHooks::register(DatawrapperHooks::GET_CHART_ACTIONS, function() use ($plugin) {
            // no export possible without email
            $cfg = $plugin->getConfig();
            return array(
                'id' => 'publish-embed',
                'title' => __('Embed this chart'),
                'icon' => 'code',
                'order' => 150,
            );
        });

        // provide static assets files
        $this->declareAssets(
            array('publish-embed.js'),
            "|/chart/[^/]+/publish|"
        );
    }
}
